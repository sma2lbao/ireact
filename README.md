## React

react 更新可分为两个不同流程:

- mount: App 首次更新渲染
- update: 用户触发

### mount

mount 大体更新步骤：

1. 通过 createRoot api 进入 react 更新逻辑，代码路径： ireact/packages/react-dom/src/react-dom-root.ts

```typescript
// 代码路径： ireact/packages/react-dom/src/react-dom-root.ts
export function createRoot(container: Container) {
  // 创建FiberRoot，每次更新都是自定向下。
  const root = createContainer(container, ConcurrentRoot);
  // 收集用户事件
  listenToAllSupportedEvents(container as EventTarget);
  return {
    //  用户调用 render api
    render(element: ReactElement) {
      // 首次正式刷新起点
      updateContainer(element, root);
    },
  };
}
```

2. updateContainer api 首屏渲染入口

```typescript
/**
 * 首屏渲染阶段 render 入口
 * @param element
 * @param container
 * @returns
 */
export function updateContainer(element: unknown, container: FiberRoot) {
  const current = container.current;
  // 获取优先级
  const lane = requestUpdateLane(current);
  // update对象
  const update = createUpdate(lane);
  update.payload = { element };

  // TODO callback

  const root = enqueueUpdate(current, update, lane);
  if (root !== null) {
    // 调度开始
    scheduleUpdateOnFiber(root, current, lane);
  }
  return lane;
}
```

3. scheduleUpdateOnFiber api 调和阶段开始

```typescript
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
  ...
  // 标记fiber root有待处理的更新。
  markRootUpdated(root, lane);
  ...
  // 调度功能开始
  ensureRootIsScheduled(root);
  ...
}
```

4. ensureRootIsScheduled api

```typescript
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
}
```

processRootScheduleInMicrotask api

```typescript
/**
 * 执行微任务调度主要逻辑
 */
function processRootScheduleInMicrotask() {
  // 这个函数总是在微任务内部被调用。它永远不应该被同步调用。

  didScheduleMicrotask = false;

  // 会在遍历所有根并对它们进行调度时重新计算。
  mightHavePendingSyncWork = false;

  const currentTime = now();

  let prev = null;
  let root = firstScheduledRoot;
  while (root !== null) {
    const next = root.next;

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
```

scheduleTaskForRootDuringMicrotask api

```typescript
function scheduleTaskForRootDuringMicrotask(
  root: FiberRoot,
  currentTime: number
): Lane {
  ...
  const newCallbackNode = Scheduler_scheduleCallback(
    schedulerPriorityLevel,
    // 经过Schedulerd的并发任务的入口
    performConcurrentWorkOnRoot.bind(null, root) as any
  );

  root.callbackPriority = newCallbackPriority;
  root.callbackNode = newCallbackNode;
  return newCallbackPriority;
}
```

performConcurrentWorkOnRoot api

```typescript
/**
 * 经过Schedulerd的并发任务的入口
 */
export function performConcurrentWorkOnRoot(
  root: FiberRoot,
  didTimeout: boolean
): RenderTaskFn | null {
  ...
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes); // 同步渲染 render开始

  // The render completed.
  const finishedWork = root.current.alternate;


  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;
  finishConcurrentRender(root, exitStatus, finishedWork!, lanes);

  ensureRootIsScheduled(root);
  return getContinuationForRoot(root, originalCallbackNode);
}
```

renderRootSync api

```typescript
/**
 * 同步渲染
 * @param root
 * @param lanes
 */
function renderRootSync(root: FiberRoot, lanes: Lanes) {
  ...
  outer: do {
    try {
     ...
      workLoopSync();
      break;
    } catch (error) {
      console.error("执行 renderRootSync 发生错误", error);
      throw error;
    }
  } while (true);
  ...
}
```

workLoopSync api -> performUnitOfWork api

```typescript
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
```

finishConcurrentRender api ->commitRootWhenReady api -> commitRootImpl api

```typescript
// render完成后需要 commit
function commitRootImpl(
  root: FiberRoot,
  recoverableErrors: null | any[],
  transitions: Transition[] | null,
  renderPriorityLevel: EventPriority
) {

  ...
  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  if (finishedWork === null) {
    return null;
  }

  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  ...

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
    // 生命周期勾子
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
```
