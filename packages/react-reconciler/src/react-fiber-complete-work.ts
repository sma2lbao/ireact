import { NoFlags, Ref, StaticMask, Update } from "./react-fiber-flags";
import {
  Instance,
  appendInitialChild,
  createInstance,
  createTextInstance,
} from "react-fiber-host-config";
import { Lanes, NoLanes, mergeLanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-type";
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./react-work-tag";

function markUpdate(workInProgress: Fiber) {
  workInProgress.flags |= Update;
}

// 1.构建离屏DOM树 2.标记非结构性的Flag(如Update)
export function completeWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const newProps = workInProgress.pendingProps;

  // 1. 构建DOM 2. 将DOM插入到DOM树中
  switch (workInProgress.tag) {
    case HostComponent:
      const type = workInProgress.type;
      if (current !== null && workInProgress.stateNode !== null) {
        // update阶段
        // props 是否变化 记录变化的值
        updateHostComponent(
          current,
          workInProgress,
          type,
          newProps,
          renderLanes
        );
        if (current.ref !== workInProgress.ref) {
          markRef(workInProgress);
        }
      } else {
        // mount阶段
        if (!newProps) {
          if (workInProgress.stateNode === null) {
            throw new Error(
              "We must have new props for new mounts. This error is likely " +
                "caused by a bug in React. Please file an issue."
            );
          }

          bubbleProperties(workInProgress);
          return null;
        }
        const instance = createInstance(type, newProps); // 1. 构建DOM
        appendAllChildren(instance, workInProgress); // 2. 将DOM插入到DOM树中

        workInProgress.stateNode = instance;

        if (workInProgress.ref !== null) {
          markRef(workInProgress);
        }
      }
      bubbleProperties(workInProgress);

      // TODO:
      // preloadInstanceAndSuspendIfNeeded(
      //   workInProgress,
      //   workInProgress.type,
      //   workInProgress.pendingProps,
      //   renderLanes
      // );
      return null;
    case HostText:
      const nextText = newProps;
      if (current && workInProgress.stateNode !== null) {
        // update阶段
        const oldText = current.memoizedProps;
        if (oldText !== nextText) {
          markUpdate(workInProgress);
        }
      } else {
        // mount阶段
        const instance = createTextInstance(nextText); // 1. 构建DOM
        workInProgress.stateNode = instance;
      }
      bubbleProperties(workInProgress);
      return null;
    case HostRoot:
    case FunctionComponent:
    case Fragment:
      bubbleProperties(workInProgress);
      return null;
  }

  throw new Error(
    `Unknown unit of work tag (${workInProgress.tag}). This error is likely caused by a bug in ` +
      "React. Please file an issue."
  );
}

function appendAllChildren(parent: Instance, workInProgess: Fiber) {
  let node = workInProgess.child;
  while (node !== null) {
    if (node?.tag === HostComponent || node?.tag === HostText) {
      appendInitialChild(parent, node.stateNode);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === workInProgess) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgess) {
        return;
      }
      node = node?.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function bubbleProperties(completedWork: Fiber) {
  const didBailout =
    completedWork.alternate !== null &&
    completedWork.alternate.child === completedWork.child;

  let newChildLanes = NoLanes;
  let subtreeFlags = NoFlags;

  if (!didBailout) {
    let child = completedWork.child;
    while (child !== null) {
      newChildLanes = mergeLanes(
        newChildLanes,
        mergeLanes(child.lanes, child.childLanes)
      );

      subtreeFlags |= child.subtreeFlags;
      subtreeFlags |= child.flags;

      // Update the return pointer so the tree is consistent. This is a code
      // smell because it assumes the commit phase is never concurrent with
      // the render phase. Will address during refactor to alternate model.
      child.return = completedWork;

      child = child.sibling;
    }

    completedWork.subtreeFlags |= subtreeFlags;
  } else {
    let child = completedWork.child;
    while (child !== null) {
      newChildLanes = mergeLanes(
        newChildLanes,
        mergeLanes(child.lanes, child.childLanes)
      );

      // "Static" flags share the lifetime of the fiber/hook they belong to,
      // so we should bubble those up even during a bailout. All the other
      // flags have a lifetime only of a single render + commit, so we should
      // ignore them.
      subtreeFlags |= child.subtreeFlags & StaticMask;
      subtreeFlags |= child.flags & StaticMask;

      // Update the return pointer so the tree is consistent. This is a code
      // smell because it assumes the commit phase is never concurrent with
      // the render phase. Will address during refactor to alternate model.
      child.return = completedWork;

      child = child.sibling;
    }

    completedWork.subtreeFlags |= subtreeFlags;
  }

  completedWork.childLanes = newChildLanes;

  return didBailout;
}

function markRef(workInProgess: Fiber) {
  workInProgess.flags |= Ref;
}

function updateHostComponent(
  current: Fiber,
  workInProgress: Fiber,
  type: any,
  newProps: any,
  renderLanes: Lanes
) {
  const oldProps = current.memoizedProps;
  if (oldProps === newProps) {
    return;
  }

  markUpdate(workInProgress);
}
