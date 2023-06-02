import {
  ReactContext,
  StartTransitionOptions,
} from "@ireact/shared/react-types";
import {
  enqueueConcurrentHookUpdate,
  enqueueConcurrentHookUpdateAndEagerlyBailout,
} from "./react-fiber-concurrent-updates";
import { Flags, Passive as PassiveEffect } from "./react-fiber-flags";
import { Lane, Lanes, NoLane, NoLanes } from "./react-fiber-lane";
import {
  requestUpdateLane,
  scheduleUpdateOnFiber,
} from "./react-fiber-work-loop";
import {
  HasEffect as HookHasEffect,
  Passive as HookPassive,
  HookFlags,
} from "./react-hook-effect-tags";
import {
  BasicStateAction,
  Dispatch,
  Dispatcher,
  Fiber,
  MemoCache,
} from "./react-internal-type";
import ReactSharedInternals from "@ireact/shared/react-shared-internals";
import { getCurrentUpdatePriority } from "./react-event-priorities";

export type Update<S, A> = {
  lane: Lane;
  revertLane: Lane;
  action: A;
  hasEagerState: boolean;
  eagerState: S | null;
  next: Update<S, A> | null;
};

export type UpdateQueue<S, A> = {
  pending: Update<S, A> | null;
  lanes: Lanes;
  dispatch: null | ((action: A) => any);
  lastRenderedReducer: ((state: S, action: A) => S) | null;
  lastRenderedState: S | null;
};

export interface Hook {
  memoizedState: any;
  baseState: any;
  baseQueue: Update<any, any> | null;
  queue: UpdateQueue<any, any> | null;
  next: Hook | null;
}

type EffectInstance = {
  destroy: void | (() => void);
};

export interface Effect {
  tag: HookFlags;
  create: () => void | (() => void);
  inst: EffectInstance;
  deps: any[] | void | null;
  next: Effect | null;
}

type StoreConsistencyCheck<T> = {
  value: T;
  getSnapshot: () => T;
};

export type EventFunctionPayload<
  Args,
  Return,
  F extends (...args: Array<Args>) => Return
> = {
  ref: {
    eventFn: F;
    impl: F;
  };
  nextImpl: F;
};

export interface FunctionComponentUpdateQueue {
  lastEffect: Effect | null;
  stores: Array<StoreConsistencyCheck<any>> | null;
  events: Array<EventFunctionPayload<any, any, any>> | null;
  memoCache?: MemoCache | null;
}

let currentlyRenderingFiber: Fiber | null = null; // 当前正在执行的Fiber

let currentHook: Hook | null = null;
let workInProgressHook: Hook | null = null; // Fiber节点中当前执行的Hook

let renderLanes = NoLanes; // 当前Hook的优先级

// 在渲染阶段的任何时刻是否安排了更新。
let didScheduleRenderPhaseUpdate: boolean = false;

let didScheduleRenderPhaseUpdateDuringThisPass: boolean = false;

const { ReactCurrentDispatcher, ReactCurrentBatchConfig } =
  ReactSharedInternals;

export function resetHooksOnUnwind(workInProgress: Fiber): void {
  console.warn("TODO: ", "resetHooksOnUnwind");
}

export function renderWithHooks<Props, SecondArg>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => any,
  props: Props,
  secondArg: SecondArg,
  nextRenderLanes: Lanes
): any {
  renderLanes = nextRenderLanes;
  // 赋值
  currentlyRenderingFiber = workInProgress;

  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = NoLanes;

  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;

  let children = Component(props, secondArg);

  // TODO 保持渲染直到组件稳定(没有更多的渲染阶段更新)。
  // if (didScheduleRenderPhaseUpdate) {
  //   children = renderWithHooksAgain(
  //     workInProgress,
  //     Component,
  //     props,
  //     secondArg
  //   );
  // }

  // 重置
  finishRenderingHooks(current, workInProgress);

  return children;
}

function finishRenderingHooks(current: Fiber | null, workInProgress: Fiber) {
  renderLanes = NoLanes;
  currentlyRenderingFiber = null;

  currentHook = null;
  workInProgressHook = null;

  didScheduleRenderPhaseUpdate = false;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
  useRef: mountRef,
  useContext: readContext,
  useTransition: mountTransition,
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useRef: updateRef,
  useContext: readContext,
  useTransition: updateTransition,
};

function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  return action instanceof Function ? action(state) : action;
}

function mountState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  const hook = mountStateImpl(initialState);
  const queue = hook.queue!;

  const dispatch: Dispatch<BasicStateAction<S>> = dispatchSetState.bind(
    null,
    currentlyRenderingFiber as Fiber,
    queue
  );
  queue.dispatch = dispatch;

  return [hook.memoizedState, dispatch];
}

function updateState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, initialState);
}

function mountStateImpl<S>(initialState: (() => S) | S): Hook {
  const hook = mountWorkInProgressHook();
  if (initialState instanceof Function) {
    initialState = initialState();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue: UpdateQueue<S, BasicStateAction<S>> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState as any,
  };
  hook.queue = queue;
  return hook;
}

function mountEffect(
  create: () => (() => void) | void,
  deps: any[] | void | null
): void {
  mountEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function updateEffect(
  create: () => (() => void) | void,
  deps: any[] | void | null
): void {
  updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook();

  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;
}

function updateRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;
}

function mountEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: any[] | void | null
) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber!.flags |= fiberFlags;
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    createEffectInstance(),
    nextDeps
  );
}

function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => void | (() => void),
  deps: void | null | any[]
): void {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const effect: Effect = hook.memoizedState;
  const inst = effect.inst;

  if (currentHook !== null) {
    if (nextDeps !== null) {
      const prevEffect: Effect = currentHook.memoizedState;
      const prevDeps = prevEffect.deps || null;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushEffect(hookFlags, create, inst, nextDeps);
        return;
      }
    }
  }

  currentlyRenderingFiber!.flags |= fiberFlags;

  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    inst,
    nextDeps
  );
}

function mountTransition(): [
  boolean,
  (callback: () => void, options?: StartTransitionOptions) => void
] {
  const [isPending, setPending] = mountState(false);
  const hook = mountWorkInProgressHook();
  const start = startTransition.bind(null, setPending);
  hook.memoizedState = start;
  return [isPending, start];
}

function updateTransition(): [
  boolean,
  (callback: () => void, options?: StartTransitionOptions) => void
] {
  const [booleanOrThenable] = updateState(false);
  const hook = updateWorkInProgressHook();
  const start = hook.memoizedState;
  // TODO: 优化路径
  // const isPending =
  // typeof booleanOrThenable === "boolean"
  //   ? booleanOrThenable
  //   : // This will suspend until the async action scope has finished.
  //     useThenable(booleanOrThenable);

  return [booleanOrThenable, start];
}

// TODO
// function startTransition<S>(
//   fiber: Fiber,
//   queue: UpdateQueue<S | Thenable<S>, BasicStateAction<S | Thenable<S>>>,
//   pendingState: S,
//   finishedState: S,
//   callback: () => any,
//   options?: StartTransitionOptions
// ) {
//   const prevTransition = ReactCurr
// }

//
function startTransition<S>(
  setPending: Dispatch<boolean>,
  callback: () => void
) {
  const previousPriority = getCurrentUpdatePriority();
  setPending(true);
  const prevTransition = ReactCurrentBatchConfig.transition;
  ReactCurrentBatchConfig.transition = {};

  callback();
  setPending(false);

  ReactCurrentBatchConfig.transition = prevTransition;
}

/**
 * effect 依赖浅比较
 * @param nextDeps
 * @param pervDeps
 */
function areHookInputsEqual(nextDeps: any[], pervDeps: any[] | null): boolean {
  if (pervDeps === null) {
    // 依赖为空，需要执行回调
    return false;
  }
  for (let i = 0; i < pervDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], pervDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function pushEffect(
  tag: HookFlags,
  create: () => (() => void) | void,
  inst: EffectInstance,
  deps: any[] | void | null
): Effect {
  const effect: Effect = {
    tag,
    create,
    inst,
    deps,
    next: null,
  };

  // 组成effect环状链表
  let componentUpdateQueue = currentlyRenderingFiber!.updateQueue;
  if (componentUpdateQueue === null) {
    // 未初始化
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber!.updateQueue = componentUpdateQueue;
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }

  return effect;
}

function createFunctionComponentUpdateQueue() {
  return {
    lastEffect: null,
    events: null,
    stores: null,
    memoCache: null,
  };
}

function updateReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (i: I) => S
): [S, Dispatch<A>] {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  if (queue === null) {
    throw new Error("queue 不能空.");
  }

  queue.lastRenderedReducer = reducer;

  const current: Hook = currentHook!;

  // 不属于基本状态的最后一次变基更新。
  let baseQueue = current.baseQueue;

  // 尚未处理的最后一个待定更新。
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    // 有update没有消费
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }

    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  if (baseQueue !== null) {
    const first = baseQueue.next;
    let newState = current.baseState;

    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast: Update<S, A> | null = null;
    let update = first;

    do {
      if (newBaseQueueLast !== null) {
        const clone: Update<S, A> = {
          lane: update!.lane,
          revertLane: update!.revertLane,
          action: update!.action,
          hasEagerState: update!.hasEagerState,
          eagerState: update!.eagerState,
          next: null,
        };
        newBaseQueueLast = (newBaseQueueLast as Update<S, A>).next = clone;
      }

      // Process this update.
      const action = update?.action;
      if (update?.hasEagerState) {
        newState = update.eagerState;
      } else {
        newState = reducer(newState, action);
      }
      update = update?.next || null;
    } while (update !== null && update !== first);

    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }

    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;

    queue.lastRenderedState = newState;
  }

  const dispatch: Dispatch<A> = queue.dispatch!;

  return [hook.memoizedState, dispatch];
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };

  // mount阶段 第一个 HooK
  if (workInProgressHook === null) {
    // currentlyRenderingFiber 一般不为空，在执行mountState会赋值
    currentlyRenderingFiber &&
      (currentlyRenderingFiber.memoizedState = workInProgressHook = hook);
  } else {
    // 后续 Hook
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook!;
}

function updateWorkInProgressHook(): Hook {
  // 获取 currentHook
  let nextCurrentHook: Hook | null = null;
  if (currentHook === null) {
    // 取第一个hook
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // 取当前hook链表下一个hook
    nextCurrentHook = currentHook.next;
  }

  // 获取 workInprogressHook
  let nextWorkInProgressHook: Hook | null;
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber?.memoizedState;
  } else {
    nextWorkInProgressHook = workInProgressHook.next;
  }

  if (nextWorkInProgressHook !== null) {
    // 存在workInProgressHook时直接返回
    workInProgressHook = nextWorkInProgressHook;
    nextWorkInProgressHook = workInProgressHook.next;

    currentHook = nextCurrentHook;
  } else {
    // 第一个 hook 需要克隆currentHook
    if (nextCurrentHook === null) {
      // 当前hook为空时，需要初始化 nextCurrentHook;
      const currentFiber = currentlyRenderingFiber?.alternate;
      if (currentFiber === null) {
        const newHook = {
          memoizedState: null,

          baseState: null,
          baseQueue: null,
          queue: null,

          next: null,
        };

        nextCurrentHook = newHook;
      } else {
        throw new Error("当前hook执行环境在上一个执行环境中");
      }
    }

    currentHook = nextCurrentHook;
    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,

      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,

      next: null,
    };
    if (workInProgressHook === null) {
      // This is the first hook in the list.
      currentlyRenderingFiber!.memoizedState = workInProgressHook = newHook;
    } else {
      // Append to the end of the list.
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }
  return workInProgressHook;
}

/**
 * hook 触发更新入口
 * @param fiber
 * @param queue
 * @param action
 */
function dispatchSetState<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A
): void {
  const lane = requestUpdateLane(fiber);

  const update: Update<S, A> = {
    lane,
    revertLane: NoLane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  if (isRenderPhaseUpdate(fiber)) {
    enqueueRenderPhaseUpdate(queue, update);
  } else {
    // // fake
    // enqueueRenderPhaseUpdate(queue, update);
    const alternate = fiber.alternate;
    if (
      fiber.lanes === NoLanes &&
      (alternate === null || alternate.lanes === NoLanes)
    ) {
      // 队列当前是空的，这意味着我们可以在进入渲染阶段之前更早地计算下一个状态。
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        try {
          const currentState: S = queue.lastRenderedState as S;
          const eagerState = lastRenderedReducer(currentState, action);
          update.hasEagerState = true;
          update.eagerState = eagerState;
          if (Object.is(eagerState, currentState)) {
            enqueueConcurrentHookUpdateAndEagerlyBailout(fiber, queue, update);
            return;
          }
        } catch (error) {}
      }
    }

    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, lane);

      // TODO
      // entangleTransitionUpdate(root, queue, lane);
    }
  }
}

function isRenderPhaseUpdate(fiber: Fiber): boolean {
  const alternate = fiber.alternate;
  return (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  );
}

function enqueueRenderPhaseUpdate<S, A>(
  queue: UpdateQueue<S, A>,
  update: Update<S, A>
): void {
  //这是渲染阶段更新。
  // 将其存储在一个惰性创建的queue -> 更新链表映射中。
  // 在这个渲染通过之后，我们将重新启动并将隐藏的更新应用于work-in-progress的hook上。
  didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate =
    true;
  const pending = queue.pending;
  if (pending === null) {
    // 第一个更新hook,创建环状链表
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;
}

function createEffectInstance(): EffectInstance {
  return { destroy: undefined };
}

export function readContext<T>(context: ReactContext<T>): T {
  return readContextForConsumer(currentlyRenderingFiber, context);
}

export function readContextForConsumer<T>(
  consumer: Fiber | null,
  context: ReactContext<T>
) {
  const value = context._currentValue;
  return value;
}
