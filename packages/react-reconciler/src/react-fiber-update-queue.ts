import { enqueueConcurrentClassUpdate } from "./react-fiber-concurrent-updates";
import { Lane, Lanes, NoLane, NoLanes } from "./react-fiber-lane";
import { markSkippedUpdateLanes } from "./react-fiber-work-loop";
import { Fiber, FiberRoot } from "./react-internal-type";

export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

export interface Update<State> {
  lane: Lane;

  tag: number;
  payload: any;
  callback: (() => any) | null;

  next: Update<State> | null;
}

export interface SharedQueue<State> {
  pending: Update<State> | null;
  lanes: Lanes;
  hiddenCallbacks: Array<() => any> | null;
}

export interface UpdateQueue<State> {
  baseState: State;
  firstBaseUpdate: Update<State> | null;
  lastBaseUpdate: Update<State> | null;

  shared: SharedQueue<State>;
  callbacks: Array<() => any> | null;
}

export function createUpdate(lane: Lane): Update<any> {
  const update = {
    lane,

    tag: UpdateState,
    payload: null,
    callback: null,

    next: null,
  };

  return update;
}

export function initializeUpdateQueue<State>(fiber: Fiber): void {
  const queue: UpdateQueue<State> = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
      lanes: NoLanes,
      hiddenCallbacks: null,
    },
    callbacks: null,
  };
  fiber.updateQueue = queue;
}

export function enqueueUpdate<State>(
  fiber: Fiber,
  update: Update<State>,
  lane: Lane
): FiberRoot | null {
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) return null;

  const sharedQueue: SharedQueue<State> = updateQueue.shared;

  // 源码中需要考虑class组件，当前暂不考虑
  {
    // 直接添加update链表
    // const pending = sharedQueue.pending;
    // if (pending === null) {
    //   update.next = update;
    // } else {
    //   update.next = pending.next;
    //   pending.next = update;
    // }
    // sharedQueue.pending = update;
  }

  return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
}

// 消费Update
export function processUpdateQueue<State>(
  workInProgress: Fiber,
  props: any,
  instance: any,
  renderLanes: Lanes
) {
  const queue: UpdateQueue<State> = workInProgress.updateQueue;

  let firstBaseUpdate = queue.firstBaseUpdate;
  let lastBaseUpdate = queue.lastBaseUpdate;

  let pendingQueue = queue.shared.pending; //需要计算的更新队列
  if (pendingQueue !== null) {
    queue.shared.pending = null;

    const lastPendingUpdate = pendingQueue; // 当前指向最后添加的更新。
    const firstPendingUpdate = lastPendingUpdate.next; // 环状链表，最后一个更新指向第一个添加的更新
    lastPendingUpdate.next = null; // 断开环状链表

    // 将正在更新的队列添加到基础队列中
    if (lastBaseUpdate === null) {
      // 当前没有计算完的更新
      firstBaseUpdate = firstPendingUpdate; // 将当前第一个更新赋值给当前第一个
    } else {
      // 有计算完的更新，就需要将最后更新的下一个更新指向当前正在进行的第一个更新
      lastBaseUpdate.next = firstPendingUpdate;
    }
    lastBaseUpdate = lastPendingUpdate;

    const current = workInProgress.alternate;
    if (current !== null) {
      const currentQueue: UpdateQueue<State> = current.updateQueue;
      const currentLastBaseUpdate = currentQueue.lastBaseUpdate;
      if (currentLastBaseUpdate !== lastBaseUpdate) {
        if (currentLastBaseUpdate === null) {
          currentQueue.firstBaseUpdate = firstPendingUpdate;
        } else {
          currentLastBaseUpdate.next = firstPendingUpdate;
        }
        currentQueue.lastBaseUpdate = lastPendingUpdate;
      }
    }
  }

  // 有更新
  if (firstBaseUpdate !== null) {
    let newState = queue.baseState;
    let newLanes = NoLanes;

    let newBaseState = null;
    let newFirstBaseUpdate = null;
    let newLastBaseUpdate = null;

    let update: Update<State> = firstBaseUpdate;

    do {
      if (newLastBaseUpdate !== null) {
        const clone: Update<State> = {
          lane: NoLane,
          tag: update.tag,
          payload: update.payload,

          callback: null,
          next: null,
        };
        newLastBaseUpdate = (newLastBaseUpdate as Update<State>).next = clone;
      }

      // 计算更新
      newState = getStateFromUpdate(
        workInProgress,
        queue,
        update,
        newState,
        props,
        instance
      );
      const callback = update.callback; // 更新后的回调
      // TODO 回调处理

      update = update.next!;

      if (update === null) {
        // 计算完成
        pendingQueue = queue.shared.pending;
        if (pendingQueue === null) {
          break;
        } else {
          // 有新的更新进入
          const lastPendingUpdate = pendingQueue;
          const firshPendingUpdate = lastPendingUpdate.next;
          lastPendingUpdate.next = null;
          update = firshPendingUpdate!;
          queue.lastBaseUpdate = lastPendingUpdate;
          queue.shared.pending = null;
        }
      }
    } while (true);

    if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    queue.baseState = newBaseState!;
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;

    if (firstBaseUpdate === null) {
      queue.shared.lanes = NoLanes;
    }

    markSkippedUpdateLanes(newLanes);
    workInProgress.lanes = newLanes;
    workInProgress.memoizedState = newState;
  }
}

function getStateFromUpdate<State>(
  workInProgress: Fiber,
  queue: UpdateQueue<State>,
  update: Update<State>,
  prevState: State,
  nextProps: any,
  instance: any
): any {
  switch (update.tag) {
    case ReplaceState: {
      const payload = update.payload;
      if (typeof payload === "function") {
        const nextState = payload.call(instance, prevState, nextProps);
        return nextState;
      }
      return payload;
    }
    case CaptureUpdate: {
      // 捕获更新 不处理
      // workInProgress.flags =
      //   (workInProgress.flags & ~ShouldCapture) | DidCapture;
    }
    case UpdateState: {
      const payload = update.payload;
      let partialState;
      if (typeof payload === "function") {
        partialState = payload.call(instance, prevState, nextProps);
      } else {
        partialState = payload;
      }

      if (partialState === null || partialState === undefined) {
        return prevState;
      }
      return Object.assign({}, prevState, partialState);
    }
    case ForceUpdate: {
      // hasForceUpdate = true;
      return prevState;
    }
  }

  return prevState;
}

export function cloneUpdateQueue<State>(current: Fiber, workInProgress: Fiber) {
  const queue = workInProgress.updateQueue;
  const currentQueue = current.updateQueue;
  if (queue === currentQueue) {
    const clone: UpdateQueue<State> = {
      baseState: currentQueue.baseState,
      firstBaseUpdate: currentQueue.firstBaseUpdate,
      lastBaseUpdate: currentQueue.lastBaseUpdate,
      shared: currentQueue.shared,
      callbacks: null,
    };
    workInProgress.updateQueue = clone;
  }
}
