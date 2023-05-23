import {
  cancelTimeout,
  getCurrentEventPriority,
  noTimeout,
  resetAfterCommit,
  scheduleMicrotask,
} from "react-fiber-host-config";
import { createWorkInProgress } from "./react-fiber";
import { beginWork } from "./react-fiber-begin-work";
import {
  commitBeforeMutationEffects,
  commitLayoutEffects,
  commitMutationEffects,
  commitPassiveMountEffects,
  commitPassiveUnmountEffects,
} from "./react-fiber-commit-work";
import { completeWork } from "./react-fiber-complete-work";
import {
  BeforeMutationMask,
  LayoutMask,
  MutationMask,
  NoFlags,
  Passive,
  PassiveMask,
  StoreConsistency,
} from "./react-fiber-flags";
import {
  Lane,
  Lanes,
  NoLane,
  NoLanes,
  SyncLane,
  getNextLanes,
  includesSyncLane,
  markRootFinished,
  markRootUpdated,
  mergeLanes,
  includesBlockingLane,
  includesExpiredLane,
  removeLanes,
  markRootSuspended as markRootSuspended_dontCallThisOneDirectly,
  includesOnlyTransitions,
  includesOnlyNonUrgentLanes,
} from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-type";
import { ConcurrentMode, NoMode } from "./react-type-of-mode";
import {
  scheduleCallback as Scheduler_scheduleCallback,
  NormalPriority as NormalSchedulerPriority,
  now,
  shouldYield,
  requestPaint,
} from "./scheduler";
import {
  RenderTaskFn,
  ensureRootIsScheduled,
  flushSyncWorkOnAllRoots,
  flushSyncWorkOnLegacyRootsOnly,
  getContinuationForRoot,
} from "./react-fiber-root-scheduler";
import {
  finishQueueingConcurrentUpdates,
  getConcurrentlyUpdatedLanes,
} from "./react-fiber-concurrent-updates";
import {
  DefaultEventPriority,
  DiscreteEventPriority,
  EventPriority,
  getCurrentUpdatePriority,
  lanesToEventPriority,
  lowerEventPriority,
  setCurrentUpdatePriority,
} from "./react-event-priorities";
import { disableSchedulerTimeoutInWorkLoop } from "./react-feature-flags";
import { resetContextDependencies } from "./react-fiber-new-context";
import {
  FunctionComponentUpdateQueue,
  resetHooksOnUnwind,
} from "./react-fiber-hooks";
import { resetChildReconcilerOnUnwind } from "./react-child-fiber";
import { unwindInterruptedWork } from "./react-fiber-unwind-work";
import { Transition } from "./react-fiber-tracing-marker-component";
import { LegacyRoot } from "./react-root-tags";

/**
 * 常量区
 */
// 执行上下文
type ExecutionContext = number;
export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
export const RenderContext = /*         */ 0b010;
export const CommitContext = /*         */ 0b100;

// 执行结果状态值
type RootExitStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const RootInProgress = 0;
const RootFatalErrored = 1;
const RootErrored = 2;
const RootSuspended = 3;
const RootSuspendedWithDelay = 4;
const RootCompleted = 5;
const RootDidNotComplete = 6;

// 执行挂起问题
type SuspendedReason = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
const NotSuspended: SuspendedReason = 0;
const SuspendedOnError: SuspendedReason = 1;
const SuspendedOnData: SuspendedReason = 2;
const SuspendedOnImmediate: SuspendedReason = 3;
const SuspendedOnInstance: SuspendedReason = 4;
const SuspendedOnInstanceAndReadyToContinue: SuspendedReason = 5;
const SuspendedOnDeprecatedThrowPromise: SuspendedReason = 6;
const SuspendedAndReadyToContinue: SuspendedReason = 7;
const SuspendedOnHydration: SuspendedReason = 8;

/**
 * 变量区
 */
// Describes where we are in the React execution stack
let executionContext: ExecutionContext = NoContext;
// wip fiber root
let workInProgressRoot: FiberRoot | null = null;
// wip fiber
let workInProgress: Fiber | null = null;
// 正在渲染的lanes
let workInProgressRootRenderLanes: Lanes = NoLanes;

// 记录 wip 被挂起相关
// wip 被挂起或发生了错误，比如主线程被占用
let workInProgressSuspendedReason: SuspendedReason = NotSuspended;
let workInProgressThrownValue: any = null;

//在渲染过程中是否附加ping监听器。这与是否挂起略有不同，因为我们不会向已经执行过的promise添加多个侦听器(每个root和lane)。
let workInProgressRootDidAttachPingListener: boolean = false;

// 工作循环中的大多数事情都应该处理 workInProgressRootRenderLanes。
// 开始/完成阶段的大部分事情都应该处理 renderLanes。
export let renderLanes: Lanes = NoLanes;

// root是否完成、错误、挂起等。
let workInProgressRootExitStatus: RootExitStatus = RootInProgress;
let workInProgressRootFatalError: any = null;
let workInProgressRootSkippedLanes: Lanes = NoLanes;
let workInProgressRootInterleavedUpdatedLanes: Lanes = NoLanes;
let workInProgressRootRenderPhaseUpdatedLanes: Lanes = NoLanes;
let workInProgressRootPingedLanes: Lanes = NoLanes;
let workInProgressRootConcurrentErrors: Array<any> | null = null;
let workInProgressRootRecoverableErrors: Array<any> | null = null;

let globalMostRecentFallbackTime: number = 0;
const FALLBACK_THROTTLE_MS: number = 500;

let rootWithPendingPassiveEffects: FiberRoot | null = null;
let pendingPassiveEffectsLanes: Lanes = NoLanes;
let rootDoesHavePassiveEffects: boolean = false;
let pendingPassiveEffectsRemainingLanes: Lanes = NoLanes;

//什么时候我们应该开始放弃渲染，而选择让CPU启动。
let workInProgressRootRenderTargetTime: number = Infinity;
// 渲染花费时间
const RENDER_TIMEOUT_MS = 500;

// Use these to prevent an infinite loop of nested updates
const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount: number = 0;
let rootWithNestedUpdates: FiberRoot | null = null;
let isFlushingPassiveEffects = false;
let didScheduleUpdateDuringPassiveEffects = false;

const NESTED_PASSIVE_UPDATE_LIMIT = 50;
let nestedPassiveUpdateCount: number = 0;
let rootWithPassiveNestedUpdates: FiberRoot | null = null;

let workInProgressTransitions: any[] | null = null;

/**
 * 首次及更新渲染入口
 * @param root
 * @param fiber
 * @param lane
 * @param eventTime
 */
export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  lane: Lane
) {
  // 检查workLoop当前是否挂起并等待数据完成加载。
  if (
    (root === workInProgressRoot &&
      workInProgressSuspendedReason === SuspendedOnData) ||
    root.cancelPendingCommit !== null
  ) {
    prepareFreshStack(root, NoLanes);
    markRootSuspended(root, workInProgressRootRenderLanes);
  }
  // 标记fiber root有待处理的更新。
  markRootUpdated(root, lane);

  if (
    (executionContext & RenderContext) !== NoLanes &&
    root === workInProgressRoot
  ) {
    //这个更新是在渲染阶段发送的。
    // 如果更新来自用户空间(除了本地钩子更新，它们的处理方式不同，不会到达这个函数)，
    // 这是一个错误，但是有一些内部的React功能使用这个作为实现细节，比如选择性hydration。
    workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
      workInProgressRootRenderPhaseUpdatedLanes,
      lane
    );
  } else {
    if (root === workInProgressRoot) {
      //在渲染过程中接收到树的更新。标记在这个根上有一个交错的更新工作。
      if ((executionContext & RenderContext) === NoContext) {
        workInProgressRootInterleavedUpdatedLanes = mergeLanes(
          workInProgressRootInterleavedUpdatedLanes,
          lane
        );
      }
      if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
        // 根已经挂起了一个延迟，这意味着这个渲染肯定不会完成。
        // 因为我们有一个新的更新，让我们把它标记为暂停，就在标记即将到来的更新之前。
        // 这有中断当前渲染并切换到更新的效果。
        markRootSuspended(root, workInProgressRootRenderLanes);
      }
    }

    // 调度功能开始
    ensureRootIsScheduled(root);

    if (
      lane === SyncLane &&
      executionContext === NoContext &&
      (fiber.mode & ConcurrentMode) === NoMode
    ) {
      //立即清除同步工作，除非我们已经在工作或在批处理中。
      // 这是故意在scheduleUpdateOnFiber中而不是在scheduleCallbackForFiber中，
      // 以保留调度回调而不立即刷新它的能力。
      // 我们只对用户发起的更新这样做，以保留遗留模式的历史行为。
      resetRenderTimer();
      flushSyncWorkOnLegacyRootsOnly();
    }
  }
}
/**
 * 这是不经过Scheduler的同步任务的入口
 * @param root
 */
export function performSyncWorkOnRoot(root: FiberRoot) {
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error("Should not already be working.");
  }

  flushPassiveEffects();

  let lanes = getNextLanes(root, NoLanes);
  if (!includesSyncLane(lanes)) {
    // There's no remaining sync work left.
    ensureRootIsScheduled(root);
    return null;
  }

  let exitStatus = renderRootSync(root, lanes);

  if (exitStatus === RootDidNotComplete) {
    //被中断的树。这种情况发生在需要退出当前渲染而不生成一致树或提交。
    markRootSuspended(root, lanes);
    ensureRootIsScheduled(root);
    return null;
  }

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;
  commitRoot(
    root,
    workInProgressRootRecoverableErrors,
    workInProgressTransitions
  );

  //退出之前，确保有一个回调为下一个调度等待的水平。
  ensureRootIsScheduled(root);

  return null;
}

/**
 * 经过Schedulerd的并发任务的入口
 */
export function performConcurrentWorkOnRoot(
  root: FiberRoot,
  didTimeout: boolean
): RenderTaskFn | null {
  const originalCallbackNode = root.callbackNode;
  const didFlushPassiveEffects = flushPassiveEffects();

  if (didFlushPassiveEffects) {
    if (root.callbackNode !== originalCallbackNode) {
      return null;
    } else {
      // 当前任务没有取消，继续执行
    }
  }

  let lanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  );
  if (lanes === NoLanes) {
    return null;
  }

  // 18.3 问题BUG 后续修复会去除
  const shouldTimeSlice =
    !includesBlockingLane(root, lanes) &&
    !includesExpiredLane(root, lanes) &&
    (disableSchedulerTimeoutInWorkLoop || !didTimeout);

  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes);

  if (exitStatus !== RootInProgress) {
    if (exitStatus === RootErrored) {
      console.warn("TODO");
    }
    if (exitStatus === RootFatalErrored) {
      console.warn("TODO");
    }
    if (exitStatus === RootDidNotComplete) {
      console.warn("TODO");
    } else {
      // The render completed.
      const renderWasConcurrent = !includesBlockingLane(root, lanes);
      const finishedWork = root.current.alternate;

      if (
        renderWasConcurrent &&
        !isRenderConsistentWithExternalStores(finishedWork!)
      ) {
        //在交错事件中存储发生了突变。再次同步呈现，以阻止进一步的突变。
        exitStatus = renderRootSync(root, lanes);

        if (exitStatus === RootErrored) {
          // TODO
          console.warn("RootErrored");
          throw RootErrored;
        }
        if (exitStatus === RootFatalErrored) {
          const fatalError = workInProgressRootFatalError;
          prepareFreshStack(root, NoLanes);
          markRootSuspended(root, lanes);
          ensureRootIsScheduled(root);
          throw fatalError;
        }
      }

      root.finishedWork = finishedWork;
      root.finishedLanes = lanes;
      finishConcurrentRender(root, exitStatus, finishedWork!, lanes);
    }
  }

  ensureRootIsScheduled(root);
  return getContinuationForRoot(root, originalCallbackNode);
}

function finishConcurrentRender(
  root: FiberRoot,
  exitStatus: RootExitStatus,
  finishedWork: Fiber,
  lanes: Lanes
) {
  switch (exitStatus) {
    case RootInProgress:
    case RootFatalErrored: {
      throw new Error("Root did not complete. This is a bug in React.");
    }
    case RootSuspendedWithDelay: {
      if (includesOnlyTransitions(lanes)) {
        // This is a transition, so we should exit without committing a
        // placeholder and without scheduling a timeout. Delay indefinitely
        // until we receive more data.
        markRootSuspended(root, lanes);
        return;
      }
      // Commit the placeholder.
      break;
    }
    case RootErrored:
    case RootSuspended:
    case RootCompleted: {
      break;
    }
    default: {
      throw new Error("Unknown root exit status.");
    }
  }

  commitRootWhenReady(
    root,
    finishedWork,
    workInProgressRootRecoverableErrors,
    workInProgressTransitions,
    lanes
  );
}

/**
 * 同步渲染
 * @param root
 * @param lanes
 */
function renderRootSync(root: FiberRoot, lanes: Lanes) {
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;

  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    // TODO: Transitions
    // workInProgressTransitions = getTransitionsForLanes(root, lanes);
    prepareFreshStack(root, lanes);
  }

  outer: do {
    try {
      if (
        workInProgressSuspendedReason !== NotSuspended &&
        workInProgress !== null
      ) {
        const unitOfWork = workInProgress;
        const thrownValue = workInProgressThrownValue;
        switch (workInProgressSuspendedReason) {
          case SuspendedOnHydration: {
            resetWorkInProgressStack();
            workInProgressRootExitStatus = RootDidNotComplete;
            break outer;
          }
          default: {
            // Unwind then continue with the normal work loop.
            workInProgressSuspendedReason = NotSuspended;
            workInProgressThrownValue = null;
            throwAndUnwindWorkLoop(unitOfWork, thrownValue);
            break;
          }
        }
      }
      workLoopSync();
      break;
    } catch (error) {
      console.error("执行 renderRootSync 发生错误", error);
      throw error;
    }
  } while (true);

  resetContextDependencies();
  executionContext = prevExecutionContext;

  // 将此设置为null表示没有正在进行的渲染。
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;

  // 现在可以安全地处理队列了，因为渲染阶段已经完成。
  finishQueueingConcurrentUpdates();
  return workInProgressRootExitStatus;
}

/**
 * 并发任务渲染
 * @param root
 * @param lanes
 */
function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;

  // 如果 root 或 lanes 已经改变，扔掉现有的堆栈并准备一个新的。否则我们将从中断的地方继续。
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    // workInProgressTransitions = getTransitionsForLanes(root, lanes);
    resetRenderTimer();
    prepareFreshStack(root, lanes);
  }

  outer: do {
    try {
      if (
        workInProgressSuspendedReason !== NotSuspended &&
        workInProgress !== null
      ) {
        // 工作循环被挂起。我们需要展开堆栈或重放挂起的组件。
        const unitOfWork = workInProgress;
        const thrownValue = workInProgressThrownValue;
        resumeOrUnwind: switch (workInProgressSuspendedReason) {
          case SuspendedOnError: {
            // Unwind then continue with the normal work loop.
            workInProgressSuspendedReason = NotSuspended;
            workInProgressThrownValue = null;
            throwAndUnwindWorkLoop(unitOfWork, thrownValue);
            break;
          }
          case SuspendedOnData: {
            console.warn("TODO");
            break outer;
          }
          default: {
            console.warn("TODO");
            throw new Error(
              "Unexpected SuspendedReason. This is a bug in React."
            );
          }
        }
      }

      workLoopConcurrent();

      break;
    } catch (error) {
      console.error(error);
      throw error;
    }
  } while (true);
  resetContextDependencies();
  executionContext = prevExecutionContext;

  // 检查 wip tree 是否完成
  if (workInProgress !== null) {
    return RootInProgress;
  } else {
    workInProgressRoot = null;
    workInProgressRootRenderLanes = NoLanes;

    finishQueueingConcurrentUpdates();

    return workInProgressRootExitStatus;
  }
}

/**
 * 同步任务工作循环
 */
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

/**
 * 并发任务工作循环
 */
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

/**
 * 执行单元任务
 * @param unitOfWork
 */
function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate;
  // next 可能为 null 或 子fiber;
  const next = beginWork(current, unitOfWork, renderLanes);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(unitOfWork: Fiber): void {
  // 尝试完成当前的工作单元，然后移动到下一个同级。如果没有更多的兄弟节点，则返回到父fiber。
  let completedWork: Fiber = unitOfWork;

  do {
    // current fiber状态为备用状态。理想情况下，不应该依赖于它，
    // 但在这里依赖它意味着我们不需要在wip中添加额外的字段。
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;
    const next = completeWork(current, completedWork, renderLanes);

    // 完成这一fiber产生了新的工作。接下来再做这个。
    if (next !== null) {
      workInProgress = next;
      return;
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }
    completedWork = returnFiber!;
    workInProgress = completedWork;
  } while (completedWork !== null);

  // 遍历到 root.
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted;
  }
}

function commitRootWhenReady(
  root: FiberRoot,
  finishedWork: Fiber,
  recoverableErrors: any[] | null,
  transitions: any[] | null,
  lanes: Lanes
) {
  if (includesOnlyNonUrgentLanes(lanes)) {
    // TODO
    console.warn("TODO: NonUrgentLanes");
  }

  commitRoot(root, recoverableErrors, transitions);
}

function commitRoot(
  root: FiberRoot,
  recoverableErrors: null | any[],
  transitions: Transition[] | null
) {
  const previousUpdateLanePriority = getCurrentUpdatePriority();
  try {
    setCurrentUpdatePriority(DiscreteEventPriority);
    commitRootImpl(
      root,
      recoverableErrors,
      transitions,
      previousUpdateLanePriority
    );
  } finally {
    setCurrentUpdatePriority(previousUpdateLanePriority);
  }
  return null;
}

function commitRootImpl(
  root: FiberRoot,
  recoverableErrors: null | any[],
  transitions: Transition[] | null,
  renderPriorityLevel: EventPriority
) {
  do {
    // 'flushPassiveEffects'将在最后调用'flushSyncUpdateQueue'，
    // 这意味着' flushPassiveEffects '有时会导致额外的passive effects。
    // 所以我们需要在循环中不断刷新，直到没有更多的pending effects。
    flushPassiveEffects();
  } while (rootWithPendingPassiveEffects !== null);

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error("Should not already be working.");
  }

  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  if (finishedWork === null) {
    return null;
  }

  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  if (finishedWork === root.current) {
    throw new Error(
      "Cannot commit the same tree as before. This error is likely caused by " +
        "a bug in React. Please file an issue."
    );
  }

  // commitRoot永远不会返回continuation;它总是同步完成。
  // 所以我们现在可以清除这些，以允许一个新的回调被调度。
  root.callbackNode = null;
  root.callbackPriority = NoLane;
  root.cancelPendingCommit = null;

  // 检查哪些lanes不再安排任何工作，并将其标记为已完成。
  let remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes);

  //确保在渲染阶段被并发事件更新的lanes;不要把它们标记为完成。
  const concurrentlyUpdatedLanes = getConcurrentlyUpdatedLanes();
  remainingLanes = mergeLanes(remainingLanes, concurrentlyUpdatedLanes);

  markRootFinished(root, remainingLanes);

  if (root === workInProgressRoot) {
    workInProgressRoot = null;
    workInProgress = null;
    workInProgressRootRenderLanes = NoLanes;
  }

  //如果有pending passive effects，调度回调来处理它们。
  //尽可能早地执行此操作，以便在commit阶段可能安排的任何其他操作之前将其入队。
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      pendingPassiveEffectsRemainingLanes = remainingLanes;
      // pendingPassiveTransitions = transitions;
      Scheduler_scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects();
        return null as any;
      });
    }
  }

  // 检查整个树是否有任何effects。
  const subtreeHasEffects =
    (finishedWork.subtreeFlags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;
  const rootHasEffect =
    (finishedWork.flags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;

  if (subtreeHasEffects || rootHasEffect) {
    const previousPriority = getCurrentUpdatePriority();
    setCurrentUpdatePriority(DiscreteEventPriority);

    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;

    //提交阶段被分成几个子阶段。我们对每个阶段的effect列表进行单独的传递:
    // 所有mutation effects都在所有layout effect之前，依此类推。

    //第一阶段是“before mutation”阶段。在对宿主树进行变更之前，我们使用这个阶段来读取它的状态。
    // 这就是getSnapshotBeforeUpdate被调用的地方。
    const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(
      root,
      finishedWork
    );

    // mutation phase
    commitMutationEffects(root, finishedWork, lanes);

    resetAfterCommit(root.containerInfo);

    root.current = finishedWork;

    // layout
    commitLayoutEffects(finishedWork, root, lanes);

    // Tell Scheduler to yield at the end of the frame, so the browser has an
    // opportunity to paint.
    requestPaint();
    executionContext = prevExecutionContext;

    // Reset the priority to the previous non-sync value.
    setCurrentUpdatePriority(previousPriority);
  } else {
    root.current = finishedWork;
  }

  if (rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
  }

  remainingLanes = root.pendingLanes;

  //总是在退出' commitRoot '之前调用这个，以确保这个root上的任何额外工作都被调度。
  ensureRootIsScheduled(root);

  // 如果passive effect 是离散渲染，在当前任务结束时同步刷新它们，以便立即观察到结果。
  // 否则，我们假设它们不依赖于顺序，不需要外部系统观察，所以我们可以等到point之后。
  if (includesSyncLane(pendingPassiveEffectsLanes) && root.tag !== LegacyRoot) {
    flushPassiveEffects();
  }

  remainingLanes = root.pendingLanes;
  if (includesSyncLane(remainingLanes)) {
    if (root === rootWithNestedUpdates) {
      nestedUpdateCount++;
    } else {
      nestedUpdateCount = 0;
      rootWithNestedUpdates = root;
    }
  } else {
    nestedUpdateCount = 0;
  }

  // If layout work was scheduled, flush it now.
  flushSyncWorkOnAllRoots();

  return null;
}

/**
 * 处理 副作用 Effect
 * @returns
 */
export function flushPassiveEffects(): boolean {
  if (rootWithPendingPassiveEffects !== null) {
    const root = rootWithPendingPassiveEffects;

    const remainingLanes = pendingPassiveEffectsRemainingLanes;
    pendingPassiveEffectsRemainingLanes = NoLanes;

    const renderPriority = lanesToEventPriority(pendingPassiveEffectsLanes);
    const priority = lowerEventPriority(DefaultEventPriority, renderPriority);

    // TODO: Transition
    // const prevTransition = ReactCurrentBatchConfig.transition;

    const previousPriority = getCurrentUpdatePriority();

    try {
      setCurrentUpdatePriority(priority);
      return flushPassiveEffectsImpl();
    } finally {
      setCurrentUpdatePriority(previousPriority);

      // TODO
      //一旦  passive effects 在树中运行 —— 让组件有机会保留他们使用的缓存实例——释放根节点上的缓存池(如果有的话)
      // releaseRootPooledCache(root, remainingLanes);
    }
  }
  return false;
}

/**
 * 执行 effect 副作用具体实现
 * @returns
 */
function flushPassiveEffectsImpl() {
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }

  // TODO
  // Cache and clear the transitions flag
  // const transitions = pendingPassiveTransitions;
  // pendingPassiveTransitions = null;

  const root = rootWithPendingPassiveEffects;
  const lanes = pendingPassiveEffectsLanes;
  rootWithPendingPassiveEffects = null;
  pendingPassiveEffectsLanes = NoLanes;

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error("Cannot flush passive effects while already rendering.");
  }

  const prevExecutionContext = executionContext;
  executionContext |= CommitContext;

  commitPassiveUnmountEffects(root.current);
  commitPassiveMountEffects(root, root.current, lanes);

  executionContext = prevExecutionContext;

  // effect 回调中可能存在 update
  flushSyncWorkOnAllRoots();

  return true;
}

/**
 * 初始化Stack
 * @param root
 * @param lanes
 */
function prepareFreshStack(root: FiberRoot, lanes: Lanes): Fiber {
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  const timeoutHandle = root.timeoutHandle;
  if (timeoutHandle !== noTimeout) {
    root.timeoutHandle = noTimeout;
    cancelTimeout(timeoutHandle);
  }

  const cancelPendingCommit = root.cancelPendingCommit;
  if (cancelPendingCommit) {
    root.cancelPendingCommit = null;
    cancelPendingCommit();
  }

  resetWorkInProgressStack();
  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);

  workInProgress = rootWorkInProgress;
  workInProgressRootRenderLanes = renderLanes = lanes;
  workInProgressSuspendedReason = NotSuspended;
  workInProgressThrownValue = null;

  workInProgressRootDidAttachPingListener = false;

  workInProgressRootExitStatus = RootInProgress;
  workInProgressRootFatalError = null;
  workInProgressRootSkippedLanes = NoLanes;
  workInProgressRootInterleavedUpdatedLanes = NoLanes;
  workInProgressRootRenderPhaseUpdatedLanes = NoLanes;
  workInProgressRootPingedLanes = NoLanes;
  workInProgressRootConcurrentErrors = null;
  workInProgressRootRecoverableErrors = null;

  finishQueueingConcurrentUpdates();

  return rootWorkInProgress;
}

function resetWorkInProgressStack() {
  if (workInProgress === null) {
    return;
  }

  let interruptedWork;
  if (workInProgressSuspendedReason === NotSuspended) {
    // 正常的情况下。工程还没有开始。释放所有其父节点。
    interruptedWork = workInProgress.return;
  } else {
    // wip 挂起状态，重置 workloop 并释放挂起的fiber及其父节点
    resetSuspendedWorkLoopOnUnwind(workInProgress);
    interruptedWork = workInProgress;
  }

  while (interruptedWork !== null) {
    const current = interruptedWork.alternate;
    unwindInterruptedWork(
      current,
      interruptedWork,
      workInProgressRootRenderLanes
    );
    interruptedWork = interruptedWork.return;
  }

  workInProgress = null;
}

function throwAndUnwindWorkLoop(unitOfWork: Fiber, thrownValue: any) {
  // resetSuspendedWorkLoopOnUnwind(unitOfWork);
  // TODO
  console.warn("TODO: throwAndUnwindWorkLoop");
}

/**
 * 标记当前树存在 suspendedLanes
 * @param root
 * @param suspendedLanes
 */
function markRootSuspended(root: FiberRoot, suspendedLanes: Lanes) {
  suspendedLanes = removeLanes(suspendedLanes, workInProgressRootPingedLanes);
  suspendedLanes = removeLanes(
    suspendedLanes,
    workInProgressRootInterleavedUpdatedLanes
  );
  markRootSuspended_dontCallThisOneDirectly(root, suspendedLanes);
}

/**
 * unwind 相关
 */

function resetSuspendedWorkLoopOnUnwind(fiber: Fiber) {
  resetContextDependencies();
  resetHooksOnUnwind(fiber);
  resetChildReconcilerOnUnwind();
}

// 渲染与外部存储是否一致
function isRenderConsistentWithExternalStores(finishedWork: Fiber): boolean {
  //搜索渲染树的外部存储读取，
  // 并检查存储是否在并发事件中发生了变化。
  // 故意使用迭代循环而不是递归，这样我们就可以提前退出。
  let node: Fiber = finishedWork;
  while (true) {
    if (node.flags & StoreConsistency) {
      const updateQueue: FunctionComponentUpdateQueue | null = node.updateQueue;
      if (updateQueue !== null) {
        const checks = updateQueue.stores;
        if (checks !== null) {
          for (let i = 0; i < checks.length; i++) {
            const check = checks[i];
            const getSnapshot = check.getSnapshot;
            const renderedValue = check.value;
            try {
              if (!Object.is(getSnapshot(), renderedValue)) {
                // Found an inconsistent store.
                return false;
              }
            } catch (error) {
              // If `getSnapshot` throws, return `false`. This will schedule
              // a re-render, and the error will be rethrown during render.
              return false;
            }
          }
        }
      }
    }
    const child = node.child;
    if (node.subtreeFlags & StoreConsistency && child !== null) {
      child.return = node;
      node = child;
      continue;
    }
    if (node === finishedWork) {
      return true;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return true;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

export function markSkippedUpdateLanes(lane: Lane | Lanes): void {
  workInProgressRootSkippedLanes = mergeLanes(
    lane,
    workInProgressRootSkippedLanes
  );
}

/**
 * 工具函数-获取当前 fiber root
 */
export function getWorkInProgressRoot(): FiberRoot | null {
  return workInProgressRoot;
}

function resetRenderTimer() {
  workInProgressRootRenderTargetTime = now() + RENDER_TIMEOUT_MS;
}

export function getRenderTargetTime(): number {
  return workInProgressRootRenderTargetTime;
}
/**
 * 工具函数-获取更新优先级
 * @param fiber
 * @returns
 */
export function requestUpdateLane(fiber: Fiber) {
  const mode = fiber.mode;
  if ((mode & ConcurrentMode) === NoMode) {
    return SyncLane;
  }

  const updateLane: Lane = getCurrentUpdatePriority();

  if (updateLane !== NoLane) {
    return updateLane;
  }
  const eventLane: Lane = getCurrentEventPriority();
  return eventLane;
}

/**
 * 工具函数-获取当前 fiber root lanes
 */
export function getWorkInProgressRootRenderLanes(): Lanes {
  return workInProgressRootRenderLanes;
}
/**
 * 工具函数-获取当前执行上下文
 * @returns
 */
export function getExecutionContext(): ExecutionContext {
  return executionContext;
}

export function isWorkLoopSuspendedOnData(): boolean {
  return workInProgressSuspendedReason === SuspendedOnData;
}

export function getCurrentTime(): number {
  return now();
}

export function getRenderLanes() {
  return renderLanes;
}
