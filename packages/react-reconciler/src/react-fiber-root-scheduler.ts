import { scheduleMicrotask } from "react-fiber-host-config";
import {
  Lane,
  NoLane,
  NoLanes,
  SyncLane,
  getHighestPriorityLane,
  getNextLanes,
  includesSyncLane,
  markStarvedLanesAsExpired,
} from "./react-fiber-lane";
import { FiberRoot } from "./react-internal-type";
import {
  ImmediatePriority as ImmediateSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
  NormalPriority as NormalSchedulerPriority,
  IdlePriority as IdleSchedulerPriority,
  cancelCallback as Scheduler_cancelCallback,
  scheduleCallback as Scheduler_scheduleCallback,
  now,
} from "./scheduler";
import {
  getExecutionContext,
  getWorkInProgressRoot,
  getWorkInProgressRootRenderLanes,
  isWorkLoopSuspendedOnData,
  performConcurrentWorkOnRoot,
  performSyncWorkOnRoot,
} from "./react-fiber-work-loop";
import { LegacyRoot } from "./react-root-tags";
import {
  CommitContext,
  NoContext,
  RenderContext,
} from "./react-fiber-work-loop";
import {
  ContinuousEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  IdleEventPriority,
  lanesToEventPriority,
} from "./react-event-priorities";
import { enableDeferRootSchedulingToMicrotask } from "./react-feature-flags";

export type RenderTaskFn = (didTimeout: boolean) => RenderTaskFn | null;

// 支持多个调度树
let firstScheduledRoot: FiberRoot | null = null;
let lastScheduledRoot: FiberRoot | null = null;

// 用于防止冗余微任务被调度。
let didScheduleMicrotask: boolean = false;

// 用于快速退出 flushSync （如果没有同步工作要做时）
let mightHavePendingSyncWork: boolean = false;

let isFlushingWork: boolean = false;

let currentEventTransitionLane: Lane = NoLane;

/**
 * 任务调度
 * @param root
 * @returns
 */
export function ensureRootIsScheduled(root: FiberRoot) {
  // 只要fiber root收到更新，就会调用此函数。它做了两件事
  // 1. 确保fiber root 在根调度中
  // 2. 确保有一个待处理的微任务来处理根调度。
  // 大多数实际的调度逻辑在 `scheduleTaskForRootDuringMicrotask` 中

  // 将root添加到调度中
  if (root === lastScheduledRoot || root.next !== null) {
    // Fast path. This root is already scheduled.
  } else {
    if (lastScheduledRoot === null) {
      firstScheduledRoot = lastScheduledRoot = root;
    } else {
      lastScheduledRoot.next = root;
      lastScheduledRoot = root;
    }
  }

  // 每次收到更新都设置成 true. 直到在下次处理调度时，如果为false，可以直接退出 flushSync
  mightHavePendingSyncWork = true;

  // 在当前事件结束时，遍历每个根并确保每个任务的优先级都是正确的。
  if (!didScheduleMicrotask) {
    didScheduleMicrotask = true;
    scheduleImmediateTask(processRootScheduleInMicrotask);
  }

  if (!enableDeferRootSchedulingToMicrotask) {
    // 当此标志被禁用时，我们立即调度渲染任务而不是等待一个小任务。
    scheduleTaskForRootDuringMicrotask(root, now());
  }
}

export function flushSyncWorkOnAllRoots() {
  //允许同步调用，但是调用方应该先检查执行上下文。
  flushSyncWorkAcrossRoots_impl(false);
}

export function flushSyncWorkOnLegacyRootsOnly() {
  // //允许同步调用，但是调用者应该首先检查执行上下文。
  flushSyncWorkAcrossRoots_impl(true);
}

function flushSyncWorkAcrossRoots_impl(onlyLegacy: boolean) {
  if (isFlushingWork) {
    return;
  }

  if (!mightHavePendingSyncWork) {
    return;
  }

  const workInProgressRoot = getWorkInProgressRoot();
  const workInProgressRootRenderLanes = getWorkInProgressRootRenderLanes();

  //可能会安排同步工作，也可能不会。需要检查。
  let didPerformSomeWork;
  let errors: any[] | null = null;
  isFlushingWork = true;
  do {
    didPerformSomeWork = false;
    let root = firstScheduledRoot;

    while (root !== null) {
      if (onlyLegacy && root.tag !== LegacyRoot) {
      } else {
        const nextLanes = getNextLanes(
          root,
          root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
        );
        if (includesSyncLane(nextLanes)) {
          // This root has pending sync work. Flush it now.
          try {
            // TODO:传递nextLanes作为参数，而不是重新计算performSyncWorkOnRoot内部。
            didPerformSomeWork = true;
            performSyncWorkOnRoot(root);
          } catch (error) {
            // Collect errors so we can rethrow them at the end
            if (errors === null) {
              errors = [error];
            } else {
              errors.push(error);
            }
          }
        }

        root = root.next!;
      }
    }
  } while (didPerformSomeWork);
  isFlushingWork = false;

  if (errors !== null) {
    throw new Error("执行 flushSyncWorkAcrossRoots_impl 发生错误");
  }
}

/**
 * 获取连续任务
 * @param root
 * @param originalCallbackNode
 * @returns
 */
export function getContinuationForRoot(
  root: FiberRoot,
  originalCallbackNode: any
): RenderTaskFn | null {
  // 这会在 `performConcurrentWorkOnRoot` 结束时调用，以确定我们是否需要安排一个延续任务。

  // 通常 `scheduleTaskForRootDuringMicrotask` 只在微任务中运行；
  // 然而，由于确定我们是否需要继续任务和新任务的大部分逻辑是相同的，我们稍微作弊并在这里调用它。
  // 这样做是安全的，因为我们知道我们已经完成了浏览器任务。
  // 所以虽然它不是一个真正的微任务，但它也可能是。
  scheduleTaskForRootDuringMicrotask(root, now());
  if (root.callbackNode === originalCallbackNode) {
    // 为该根调度的任务节点与当前执行的任务节点相同。需要返回一个延续。
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  return null;
}

/**
 * 调度Immediate任务
 * @param cb
 */
function scheduleImmediateTask(cb: () => any) {
  scheduleMicrotask(() => {
    const executionContext = getExecutionContext();
    if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
      // Note that this would still prematurely flush the callbacks
      // if this happens outside render or commit phase (e.g. in an event).
      // Intentionally using a macrotask instead of a microtask here.
      Scheduler_scheduleCallback(ImmediateSchedulerPriority, cb);
      return;
    }

    cb();
  });
}

/**
 * 执行微任务调度主要逻辑
 */
function processRootScheduleInMicrotask() {
  // 这个函数总是在微任务内部被调用。它永远不应该被同步调用。
  if (__DEV__) {
    console.log("微任务调度中");
  }

  didScheduleMicrotask = false;

  // 会在遍历所有根并对它们进行调度时重新计算。
  mightHavePendingSyncWork = false;

  const currentTime = now();

  let prev = null;
  let root = firstScheduledRoot;
  while (root !== null) {
    const next = root.next;

    // TODO：  TransitionLane 相关实现
    //  if (
    //    currentEventTransitionLane !== NoLane &&
    //    shouldAttemptEagerTransition()
    //  ) {
    //    markRootEntangled(
    //      root,
    //      mergeLanes(currentEventTransitionLane, SyncLane)
    //    );
    //  }

    const nextLanes = scheduleTaskForRootDuringMicrotask(root, currentTime);

    if (nextLanes === NoLane) {
      // root没有pending的任务。把它从schedule中删除。
      // 为了防止微妙的重入错误，
      // 这个微任务是我们做这件事的唯一地方 - 你可以随时向schedule加root，但你只能在这里删除它们。

      // 取消此值，以便清楚它已从调度中删除。
      root.next === null;
      if (prev === null) {
        firstScheduledRoot = next;
      } else {
        prev.next = next;
      }
      if (next === null) {
        lastScheduledRoot = prev;
      }
    } else {
      prev = root;
      if (includesSyncLane(nextLanes)) {
        mightHavePendingSyncWork = true;
      }
    }

    root = next;
  }

  currentEventTransitionLane = NoLane;

  //在微任务结束时，刷新所有挂起的同步工作。这必须出现在最后，因为它做实际的渲染工作，可能会抛出。
  flushSyncWorkOnAllRoots();
}

function scheduleTaskForRootDuringMicrotask(
  root: FiberRoot,
  currentTime: number
): Lane {
  // 这个函数总是在微任务内部调用，或者在渲染任务的最后，在让位主线程之前调用。它永远不应该被同步调用。
  // 这个函数也不会同步执行React工作;它应该只将工作安排在稍后执行，在一个单独的任务或微任务中。

  //检查是否有lanes被其他工作占用。如果有，将它们标记为过期，以便我们知道下一步要处理它们。
  markStarvedLanesAsExpired(root, currentTime);

  // 确定下一个要执行的lanes，以及它们的优先级。
  const workInProgressRoot = getWorkInProgressRoot();
  const workInProgressRootRenderLanes = getWorkInProgressRootRenderLanes();
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  );

  const existingCallbackNode = root.callbackNode;
  if (
    // 检查 lanes
    nextLanes === NoLanes ||
    //如果这个root当前挂起并等待数据解析，不要调度任务来渲染它。我们要么等待唤醒，要么等待接收更新。
    // Suspended render phase
    (root === workInProgressRoot && isWorkLoopSuspendedOnData()) ||
    //  Suspended commit phase
    root.cancelPendingCommit !== null
  ) {
    // Fast path: There's nothing to work on.
    if (existingCallbackNode !== null) {
      Scheduler_cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return NoLanes;
  }

  // 在宿主环境中安排一个新的回调。
  if (includesSyncLane(nextLanes)) {
    // 同步工作总是在微任务结束时被刷新，所以我们不需要安排一个额外的任务。

    if (existingCallbackNode !== null) {
      Scheduler_cancelCallback(existingCallbackNode);
    }
    root.callbackPriority = SyncLane;
    root.callbackNode = null;

    return SyncLane;
  } else {
    // 取最高优先级lanes。
    const existingCallbackPriority = root.callbackPriority;
    const newCallbackPriority = getHighestPriorityLane(nextLanes);
    if (newCallbackPriority === existingCallbackPriority) {
      return newCallbackPriority;
    } else {
      existingCallbackNode && Scheduler_cancelCallback(existingCallbackNode);
    }

    let schedulerPriorityLevel;
    switch (lanesToEventPriority(nextLanes)) {
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediateSchedulerPriority;
        break;
      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingSchedulerPriority;
        break;
      case DefaultEventPriority:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
      case IdleEventPriority:
        schedulerPriorityLevel = IdleSchedulerPriority;
        break;
      default:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
    }

    const newCallbackNode = Scheduler_scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root) as any
    );

    root.callbackPriority = newCallbackPriority;
    root.callbackNode = newCallbackNode;
    return newCallbackPriority;
  }
}
