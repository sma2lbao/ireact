import { Flags } from "./react-fiber-flags";
import { Container, NoTimeout, TimeoutHandle } from "react-fiber-host-config";
import { Lane, LaneMap, Lanes } from "./react-fiber-lane";
import { WorkTag } from "./react-work-tag";
import { RootTag } from "./react-root-tags";
import { ConcurrentUpdate } from "./react-fiber-concurrent-updates";

export type Fiber = {
  tag: WorkTag;

  key: string | null;

  elementType: any;

  type: any;

  stateNode: any;

  return: Fiber | null;

  child: Fiber | null;

  sibling: Fiber | null;

  index: number;

  ref: any;

  refCleanup: null | (() => void);

  pendingProps: any;
  memoizedProps: any;

  updateQueue: any;

  memoizedState: any;

  dependencies: any;

  mode?: any;

  flags: Flags;
  subtreeFlags: Flags;
  deletions: Array<Fiber> | null;

  nextEffect: Fiber | null;

  firstEffect: Fiber | null;
  lastEffect: Fiber | null;

  lanes: Lanes;
  childLanes: Lanes;

  alternate: Fiber | null;

  actualDuration?: number;

  actualStartTime?: number;

  selfBaseDuration?: number;

  treeBaseDuration?: number;
};

type BaseFiberRootProperties = {
  tag: RootTag;

  containerInfo: Container;

  current: Fiber;

  finishedWork: Fiber | null;

  // 需要执行的 lanes
  pendingLanes: Lanes;
  // 挂起的 lanes
  suspendedLanes: Lanes;

  pingedLanes: Lanes;
  expiredLanes: Lanes;

  finishedLanes: Lanes;

  // 用于创建一个链表，该链表表示所有在其上安排了待处理工作的根。
  next: FiberRoot | null;

  // Scheduler.scheduleCallback 返回的节点。代表下一次渲染根将处理的任务
  callbackNode: any;
  callbackPriority: Lane;
  expirationTimes: LaneMap<number>;
  hiddenUpdates: LaneMap<Array<ConcurrentUpdate> | null>;

  // 当一个 root 有一个挂起的提交计划时，调用这个函数将取消它。
  cancelPendingCommit: null | (() => void);
  // setTimeout 返回的超时句柄。如果它被新的超时取代用于取消挂起的超时。
  timeoutHandle: TimeoutHandle | NoTimeout;
};

export type FiberRoot = BaseFiberRootProperties & unknown;

export type BasicStateAction<S> = ((state?: S) => S) | S;
export type Dispatch<A> = (action?: A) => void;
export interface Dispatcher {
  useState<S>(initialState: S | (() => S)): [S, Dispatch<BasicStateAction<S>>];
  useEffect(create: () => void | (() => void), deps: void | null | any[]): void;
  useRef<T>(initialValue: T): { current: T };
}

export type MemoCache = {
  data: Array<Array<any>>;
  index: number;
};
