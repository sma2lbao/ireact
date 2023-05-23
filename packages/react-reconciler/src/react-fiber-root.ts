import { createHostRootFiber } from "./react-fiber";
import { Container, noTimeout } from "react-fiber-host-config";
import { initializeUpdateQueue } from "./react-fiber-update-queue";
import { Fiber, FiberRoot } from "./react-internal-type";
import { RootTag } from "./react-root-tags";
import {
  NoLane,
  NoLanes,
  NoTimestamp,
  createLaneMap,
} from "./react-fiber-lane";

export type RootState = {
  element: any;
  isDehydrated: boolean;
  cache: Cache | null;
};

export class FiberRootNode {
  containerInfo;

  tag: RootTag;

  current: Fiber;

  finishedWork: Fiber | null = null;

  callbackNode = null;
  callbackPriority = NoLane;
  expirationTimes = createLaneMap(NoTimestamp);
  hiddenUpdates = createLaneMap(null);

  pendingLanes = NoLanes;
  finishedLanes = NoLanes;

  suspendedLanes = NoLanes;
  pingedLanes = NoLanes;
  expiredLanes = NoLanes;

  cancelPendingCommit = null;
  timeoutHandle = noTimeout;

  next: FiberRoot | null = null;

  constructor(
    containerInfo: any,
    tag: RootTag,
    hydrate: boolean,
    initialChildren: any
  ) {
    this.containerInfo = containerInfo;
    this.tag = tag;

    const uninitializedFiber = createHostRootFiber(tag);
    this.current = uninitializedFiber;
    uninitializedFiber.stateNode = this;

    const initialState: RootState = {
      element: initialChildren,
      isDehydrated: hydrate,
      cache: null,
    };
    uninitializedFiber.memoizedState = initialState;

    initializeUpdateQueue(uninitializedFiber);
  }
}

export function createFiberRoot(
  containerInfo: Container,
  tag: RootTag,
  hydrate: boolean,
  initialChildren: any
): FiberRoot {
  const root: FiberRoot = new FiberRootNode(
    containerInfo,
    tag,
    hydrate,
    initialChildren
  );

  return root;
}
