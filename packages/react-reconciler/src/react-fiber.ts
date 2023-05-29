import { ReactElement } from "@ireact/shared/react-element-type";
import { Flags, NoFlags } from "./react-fiber-flags";
import { Lanes, NoLanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-type";
import { ConcurrentMode, NoMode, TypeOfMode } from "./react-type-of-mode";
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  WorkTag,
} from "./react-work-tag";
import { ConcurrentRoot, RootTag } from "./react-root-tags";
import { ReactFragment } from "@ireact/shared/react-types";
import { REACT_PROVIDER_TYPE } from "@ireact/shared/react-symbols";

export class FiberNode {
  // Instance
  tag: WorkTag;
  key: null | string;
  elementType: any = null;
  type: any = null;
  stateNode: any = null;

  // Fiber
  return: Fiber | null = null;
  child: Fiber | null = null;
  sibling: Fiber | null = null;
  index: number = 0;

  ref: unknown = null;
  refCleanup: null | (() => void) = null;

  pendingProps: any;
  memoizedProps: any = null;

  updateQueue: unknown = null;
  memoizedState: unknown = null;

  dependencies: unknown = null;

  mode: TypeOfMode;

  // Effects
  flags: Flags = NoFlags;
  subtreeFlags: Flags = NoFlags;
  deletions: Array<Fiber> | null = null;

  nextEffect: Fiber | null = null;

  firstEffect: Fiber | null = null;
  lastEffect: Fiber | null = null;

  lanes: Lanes = NoLanes;
  childLanes: Lanes = NoLanes;

  alternate: Fiber | null = null;

  constructor(
    tag: WorkTag,
    pendingProps: any,
    key: null | string,
    mode: TypeOfMode
  ) {
    this.tag = tag;
    this.key = key;

    this.pendingProps = pendingProps;

    this.mode = mode;
  }
}

export function createFiber(
  tag: WorkTag,
  pendingProps: unknown,
  key: string | null,
  mode: TypeOfMode
): Fiber {
  return new FiberNode(tag, pendingProps, key, mode);
}

export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    //首次渲染
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode
    );
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    // update
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;
    // 副作用重置
    workInProgress.flags = NoFlags;

    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }
  workInProgress.flags = current.flags;
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;
  workInProgress.refCleanup = current.refCleanup;

  return workInProgress;
}

export function createFiberFromText(
  content: string,
  mode: TypeOfMode,
  lanes: Lanes
) {
  const fiber = createFiber(HostText, content, null, mode);
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromFragment(
  elements: ReactFragment,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string
): Fiber {
  const fiber = createFiber(Fragment, elements, key, mode);
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromElement(
  element: ReactElement,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  const { type, key, props } = element;
  const fiber = createFiberFromTypeAndProps(
    type,
    key,
    props,
    null,
    mode,
    lanes
  );
  return fiber;
}

export function createFiberFromTypeAndProps(
  type: any,
  key: null | string,
  pendingProps: any,
  owner: null | Fiber,
  mode: TypeOfMode,
  lanes: Lanes
): Fiber {
  let fiberTag: WorkTag = FunctionComponent;
  if (typeof type === "string") {
    fiberTag = HostComponent;
  } else if (
    typeof type === "object" &&
    type !== null &&
    type.$$typeof === REACT_PROVIDER_TYPE
  ) {
    fiberTag = ContextProvider;
  } else if (typeof type !== "function") {
    if (__DEV__) {
      console.warn("未定义的type类型", type);
    }
  }

  const fiber = createFiber(fiberTag, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = type;
  fiber.lanes = lanes;

  return fiber;
}

export function createHostRootFiber(tag: RootTag): Fiber {
  let mode;
  if (tag === ConcurrentRoot) {
    mode = ConcurrentMode;
  } else {
    mode = NoMode;
  }
  return createFiber(HostRoot, null, null, mode);
}
