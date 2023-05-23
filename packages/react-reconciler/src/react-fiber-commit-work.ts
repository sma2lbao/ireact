import {
  BeforeMutationMask,
  ChildDeletion,
  LayoutMask,
  MutationMask,
  NoFlags,
  Passive,
  PassiveMask,
  Placement,
  Ref,
  Update,
} from "./react-fiber-flags";
import {
  Container,
  Instance,
  appendChild,
  appendChildToContainer,
  commitTextUpdate,
  commitUpdate,
  getPublicInstance,
  insertBefore,
  insertInContainerBefore,
  prepareForCommit,
  removeChild,
  removeChildFromContainer,
} from "react-fiber-host-config";
import { Lanes } from "./react-fiber-lane";
import { Fiber, FiberRoot } from "./react-internal-type";
import {
  ForwardRef,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./react-work-tag";
import {
  HasEffect as HookHasEffect,
  Layout as HookLayout,
  Insertion as HookInsertion,
  Passive as HookPassive,
  NoFlags as NoHookEffect,
  HookFlags,
} from "./react-hook-effect-tags";
import { FunctionComponentUpdateQueue } from "./react-fiber-hooks";

let nextEffect: Fiber | null = null;

let focusedInstanceHandle: null | Fiber = null;
let shouldFireAfterActiveInstanceBlur: boolean = false;
export function commitBeforeMutationEffects(
  root: FiberRoot,
  firstChild: Fiber
): boolean {
  focusedInstanceHandle = prepareForCommit(root.containerInfo) as any;

  nextEffect = firstChild;
  commitBeforeMutationEffects_begin();

  // We no longer need to track the active instance fiber
  const shouldFire = shouldFireAfterActiveInstanceBlur;
  shouldFireAfterActiveInstanceBlur = false;
  focusedInstanceHandle = null;

  return shouldFire;
}

function commitBeforeMutationEffects_begin() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const child = fiber.child;
    if (
      (fiber.subtreeFlags & BeforeMutationMask) !== NoFlags &&
      child !== null
    ) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitBeforeMutationEffects_complete();
    }
  }
}

function commitBeforeMutationEffects_complete() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    try {
      commitBeforMutationEffectsOnFiber(fiber);
    } catch (error) {
      console.error(error);
      throw error;
    }
    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

/**
 * 针对 Snapshot 副作用处理，当前不考虑
 * @param finishedWork
 */
function commitBeforMutationEffectsOnFiber(finishedWork: Fiber) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case HostComponent:
    case HostText:
    case FunctionComponent:
    case ForwardRef: {
      break;
    }
    default:
      break;
  }
}

/**
 * Mutation阶段入口
 * @param root
 * @param finishedWork
 */
export function commitMutationEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
) {
  commitMutationEffectsOnFiber(finishedWork, root, committedLanes);
}

/**
 * Layout 阶段入口
 * @param finishedWork
 * @param root
 * @param committedLanes
 */
export function commitLayoutEffects(
  finishedWork: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
): void {
  const current = finishedWork.alternate;
  commitLayoutEffectOnFiber(root, current, finishedWork, committedLanes);
}

export function disappearLayoutEffects(finishedWork: Fiber) {
  switch (finishedWork.tag) {
    case FunctionComponent: {
      commitHookEffectListUnmount(
        HookLayout,
        finishedWork,
        finishedWork.return
      );
      recursivelyTraverseDisappearLayoutEffects(finishedWork);
      break;
    }
    case HostComponent: {
      safelyDetachRef(finishedWork, finishedWork.return);

      recursivelyTraverseDisappearLayoutEffects(finishedWork);
      break;
    }
    default: {
      recursivelyTraverseDisappearLayoutEffects(finishedWork);
      break;
    }
  }
}

/**
 * 导出供外部调用渲染阶段 副作用 effect 的执行
 * @param root
 * @param finishedWork
 * @param committedLanes
 */
export function commitPassiveMountEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
  // committedTransitions: Array<Transition> | null
) {
  commitPassiveMountOnFiber(root, finishedWork, committedLanes);
}

/**
 * 导出供外部调用卸载阶段 副作用 effect 的执行
 * @param finishedWork
 */
export function commitPassiveUnmountEffects(finishedWork: Fiber): void {
  commitPassiveUnmountOnFiber(finishedWork);
}

function commitMutationEffectsOnFiber(
  finishedWork: Fiber,
  root: FiberRoot,
  lanes: Lanes
) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  switch (finishedWork.tag) {
    case FunctionComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      if (flags & Update) {
        try {
          commitHookEffectListUnmount(
            HookHasEffect | HookHasEffect,
            finishedWork,
            finishedWork.return
          );
          commitHookEffectListMount(
            HookHasEffect | HookHasEffect,
            finishedWork
          );
        } catch (error) {
          console.error(error);
          throw error;
        }
      }

      // Layout effects在 mutation阶段被销毁，这样所有fiber的所有destroy函数都会在create函数之前被调用。
      // 这可以防止兄弟组件的效果相互干扰，例如，在同一个提交期间，
      // 一个组件中的destroy函数不应该覆盖另一个组件中的create函数设置的ref。
      try {
        commitHookEffectListUnmount(
          HookLayout | HookHasEffect,
          finishedWork,
          finishedWork.return
        );
      } catch (error) {
        console.error(error);
        throw error;
      }
      return;
    }
    case HostComponent:
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      if (flags & Ref) {
        if (current !== null) {
          safelyDetachRef(current, current.return);
        }
      }

      if (flags & Update) {
        const instance = finishedWork.stateNode;
        if (instance !== null) {
          const newProps = finishedWork.memoizedProps;
          const oldProps = current !== null ? current.memoizedProps : newProps;
          const type = finishedWork.type;
          const updatePayload = finishedWork.updateQueue;
          finishedWork.updateQueue = null;
          if (updatePayload !== null) {
            try {
              commitUpdate(
                instance,
                updatePayload,
                type,
                oldProps,
                newProps,
                finishedWork
              );
            } catch (error) {
              console.error(error);
              throw error;
            }
          }
        }
      }
      return;
    case HostText:
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      if (flags & Update) {
        const textInstance = finishedWork.stateNode;
        const newText = finishedWork.memoizedProps;
        const oldText = current !== null ? current.memoizedProps : newText;

        try {
          commitTextUpdate(textInstance, oldText, newText);
        } catch (error) {
          console.error(error);
          throw error;
        }
      }
      return;
    default:
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);
      return;
  }
}

function commitLayoutEffectOnFiber(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case FunctionComponent: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );
      if (flags & Update) {
        commitHookLayoutEffects(finishedWork, HookLayout | HookHasEffect);
      }
      break;
    }
    case HostRoot: {
    }
    case HostComponent: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );
      // TODO
      // 渲染可能发生在宿主组件mounted之后，比如 DOM 可以为输入和表单控件安排自动对焦
      // if (current === null && flags & Update) {
      //   commitHostComponentMount(finishedWork);
      // }

      if (flags & Ref) {
        safelyAttachRef(finishedWork, finishedWork.return);
      }
      break;
    }
    default: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        committedLanes
      );
    }
  }
}

/**
 * 处理 Placement
 * @param finishedWork
 */
function commitReconciliationEffects(finishedWork: Fiber) {
  const flags = finishedWork.flags;
  if (flags & Placement) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
}

function commitPlacement(finishedWork: Fiber): void {
  //1. 找到 parent DOM
  //2. 将自身 DOM 加入 parent DOM中
  if (__DEV__) {
    console.warn("执行Placement");
  }

  const parentFiber = getHostParentFiber(finishedWork);

  switch (parentFiber.tag) {
    case HostComponent: {
      const parent = parentFiber.stateNode;

      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNode(finishedWork, before, parent);
      break;
    }
    case HostRoot: {
      const parent = parentFiber.stateNode.containerInfo;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
      break;
    }
    default:
      throw new Error("错误的父Fiber类型");
  }
}

function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }

  throw new Error("未找到HostParentFiber");
}

function isHostParent(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostRoot;
}

function getHostSibling(fiber: Fiber): Instance | null {
  let node: Fiber = fiber;
  siblings: while (true) {
    // 如果同级没有找到，需要向上找
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    // 不是宿主组件，需要向下遍历找子孙组件
    while (node.tag !== HostComponent && node.tag !== HostText) {
      // If it is not host node and, we might have a host node inside it.
      // Try to search down until we find one.
      if (node.flags & Placement) {
        // If we don't have a child, try the siblings instead.
        continue siblings;
      }
      // If we don't have a child, try the siblings instead.
      // We also skip portals because they are not part of this host tree.
      if (node.child === null) {
        continue siblings;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }

    if (!(node.flags & Placement)) {
      return node.stateNode;
    }
  }
}

function insertOrAppendPlacementNode(
  node: Fiber,
  before: Instance | undefined | null,
  parent: Instance
): void {
  const isHost = node.tag === HostComponent || node.tag === HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

function insertOrAppendPlacementNodeIntoContainer(
  node: Fiber,
  before: Instance | undefined | null,
  parent: Container
): void {
  const isHost = node.tag === HostComponent || node.tag === HostText;

  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertInContainerBefore(parent, stateNode, before);
    } else {
      appendChildToContainer(parent, stateNode);
    }
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNodeIntoContainer(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

/**
 * 处理 ChildDeletion Flag
 * @param root
 * @param parentFiber
 */
function recursivelyTraverseMutationEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  lanes: Lanes
) {
  const deletions = parentFiber.deletions;
  if (deletions !== null) {
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i];
      try {
        commitDeletionEffects(root, parentFiber, childToDelete);
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
  }

  if (parentFiber.subtreeFlags & MutationMask) {
    let child = parentFiber.child;
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root, lanes);
      child = child.sibling;
    }
  }
}

let hostParent: Instance | Container | null = null;
let hostParentIsContainer = false;
function commitDeletionEffects(
  root: FiberRoot,
  returnFiber: Fiber,
  deletedFiber: Fiber
) {
  let parent: Fiber | null = returnFiber;
  findParent: while (parent !== null) {
    switch (parent.tag) {
      case HostComponent:
        hostParent = parent.stateNode;
        hostParentIsContainer = false;
        break findParent;
      case HostRoot:
        hostParent = parent.stateNode.containerInfo;
        hostParentIsContainer = true;
        break findParent;
    }
    parent = parent.return;
  }

  if (hostParent === null) {
    throw new Error(
      "Expected to find a host parent. This error is likely caused by " +
        "a bug in React. Please file an issue."
    );
  }

  if (hostParent === null) {
    throw new Error("没有找到宿主parent节点");
  }
  commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
  hostParent = null;
  hostParentIsContainer = false;

  detachFiberMutation(deletedFiber);
}

/**
 * Deltetion Effect 具体实现
 * @param finishedRoot
 * @param nearestMountedAncestor
 * @param deletedFiber
 * @returns
 */
function commitDeletionEffectsOnFiber(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  deletedFiber: Fiber
) {
  switch (deletedFiber.tag) {
    case HostComponent: {
      safelyDetachRef(deletedFiber, nearestMountedAncestor);
      //故意切换到下一个分支 HostText
    }
    case HostText: {
      const prevHostParent = hostParent;
      const prevHostParentIsContainer = hostParentIsContainer;
      hostParent = null;
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      );
      hostParent = prevHostParent;
      hostParentIsContainer = prevHostParentIsContainer;
      if (hostParent !== null) {
        if (hostParentIsContainer) {
          removeChildFromContainer(hostParent, deletedFiber.stateNode);
        } else {
          removeChild(hostParent, deletedFiber.stateNode);
        }
      }
      return;
    }
    case FunctionComponent: {
      const updateQueue: FunctionComponentUpdateQueue | null =
        deletedFiber.updateQueue;
      if (updateQueue !== null) {
        const lastEffect = updateQueue.lastEffect;
        if (lastEffect !== null) {
          const firstEffect = lastEffect.next;

          let effect = firstEffect;
          do {
            const tag = effect!.tag;
            const inst = effect!.inst;
            const destroy = inst.destroy;
            if (destroy !== undefined) {
              if (
                (tag & HookInsertion) !== NoHookEffect ||
                (tag & HookLayout) !== NoHookEffect
              ) {
                inst.destroy = undefined;
                safelyCallDestroy(
                  deletedFiber,
                  nearestMountedAncestor,
                  destroy
                );
              }
            }
            effect = effect!.next;
          } while (effect !== firstEffect);
        }
      }
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      );
      return;
    }
    default:
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber
      );
      return;
  }
}

/**
 * 递归遍历删除
 * @param finishedRoot
 * @param nearestMountedAncestor
 * @param parent
 */
function recursivelyTraverseDeletionEffects(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  parent: Fiber
) {
  let child = parent.child;
  while (child !== null) {
    commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, child);
    child = child.sibling;
  }
}

/**
 * 解绑操作
 * @param fiber
 */
function detachFiberMutation(fiber: Fiber) {
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.return = null;
  }
  fiber.return = null;
}

/**
 * 处理当前 root fiber 树 mount 阶段的 副作用 effect 执行
 * @param finshedRoot
 * @param finishedWork
 * @param committedLanes
 */
function commitPassiveMountOnFiber(
  finshedRoot: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
  // committedTransitions: Array<Transition> | null
): void {
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case FunctionComponent: {
      // 递归
      recursivelyTraversePassiveMountEffects(
        finshedRoot,
        finishedWork,
        committedLanes
      );
      if (flags & Passive) {
        //有副作用需要执行回调
        commitHookPassiveMountEffects(
          finishedWork,
          HookPassive | HookHasEffect
        );
      }
      break;
    }
    default: {
      recursivelyTraversePassiveMountEffects(
        finshedRoot,
        finishedWork,
        committedLanes
      );
      break;
    }
  }
}

/**
 * DFS 递归遍历 mount 阶段的副作用
 * @param root
 * @param parentFiber
 * @param committedLanes
 */
function recursivelyTraversePassiveMountEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  committedLanes: Lanes
  // committedTransitions: Array<Transition> | null
) {
  if (parentFiber.subtreeFlags & PassiveMask) {
    let child = parentFiber.child;
    while (child != null) {
      commitPassiveMountOnFiber(root, child, committedLanes);
      child = child.sibling;
    }
  }
}

/**
 * 执行create 并将返回值赋值给 destroy
 * @param finishedWork
 * @param hookFlags
 */
function commitHookPassiveMountEffects(
  finishedWork: Fiber,
  hookFlags: HookFlags
) {
  try {
    commitHookEffectListMount(hookFlags, finishedWork);
  } catch (error) {
    console.error("mount 阶段执行 副作用 create 失败！", error);
    throw error;
  }
}

/**
 * mount阶段 执行updateQueue链表上effect上所有create并赋值给destroy
 * @param flags
 * @param finishedWork
 */
function commitHookEffectListMount(flags: HookFlags, finishedWork: Fiber) {
  const updateQueue: FunctionComponentUpdateQueue = finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect!;
    do {
      if ((effect.tag & flags) === flags) {
        // mount阶段
        const create = effect.create;
        const inst = effect.inst;
        const destroy = create();
        inst.destroy = destroy;
      }
      effect = effect.next!;
    } while (effect !== firstEffect);
  }
}

/**
 * 处理
 * @param finishedWork
 */
function commitPassiveUnmountOnFiber(finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case ForwardRef:
    case FunctionComponent: {
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      if (finishedWork.flags & Passive) {
        // 当前fiber节点存在副作用需要执行
        commitHookPassiveUnmountEffects(
          finishedWork,
          finishedWork.return,
          HookPassive | HookHasEffect
        );
      }
      break;
    }
    default: {
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      break;
    }
  }
}

/**
 *  DFS 递归遍历  unmount 阶段的副作用
 * @param parentFiber
 */
function recursivelyTraversePassiveUnmountEffects(parentFiber: Fiber): void {
  const deletions = parentFiber.deletions;
  if ((parentFiber.flags & ChildDeletion) !== NoFlags) {
    if (deletions !== null) {
      for (let i = 0; i < deletions.length; i++) {
        const childToDelete = deletions[i];
        nextEffect = childToDelete;
        commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
          childToDelete,
          parentFiber
        );
      }
    }
    detachAlternateSiblings(parentFiber);
  }

  if (parentFiber.subtreeFlags & PassiveMask) {
    let child = parentFiber.child;
    while (child !== null) {
      commitPassiveUnmountOnFiber(child);
      child = child.sibling;
    }
  }
}

function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
  deletedSubtreeRoot: Fiber,
  nearestMountedAncestor: Fiber | null
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    commitPassiveUnmountInsideDeletedTreeOnFiber(fiber, nearestMountedAncestor);

    const child = fiber.child;
    if (child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
        deletedSubtreeRoot
      );
    }
  }
}

function commitPassiveUnmountInsideDeletedTreeOnFiber(
  current: Fiber,
  nearestMountedAncestor: Fiber | null
): void {
  switch (current.tag) {
    case FunctionComponent: {
      commitHookPassiveUnmountEffects(
        current,
        nearestMountedAncestor,
        HookPassive
      );
      break;
    }
    default:
      console.warn(
        "未实现 commitPassiveUnmountInsideDeletedTreeOnFiber 的类型：",
        current.tag
      );
      break;
  }
}

function commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
  deletedSubtreeRoot: Fiber
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const sibling = fiber.sibling;
    const returnFiber = fiber.return;

    // 递归遍历整个删除的树并清理fiber字段。这比理想更激进，长期目标是只需要在根部分离删除的树。
    detachAlternateSiblings(fiber);
    if (fiber === deletedSubtreeRoot) {
      nextEffect = null;
      return;
    }

    if (sibling !== null) {
      sibling.return = returnFiber;
      nextEffect = sibling;
      return;
    }

    nextEffect = returnFiber;
  }
}

/**
 * 断开 alternate 上 sibling 指针
 * @param parentFiber
 */
function detachAlternateSiblings(parentFiber: Fiber) {
  // 一个在父fiber上删除的子fiber在 父fiber alternate指针上仍然存在
  // 由于children 存在 sibling 指针，可通过当前没有被删除的兄弟fiber找到被删除的fiber
  // live fiber --alternate--> previous live fiber --sibling--> deleted fiber
  // 不能断开没有被删除的fiber的alternate指针，但可以断开sibling和child指针

  const previousFiber = parentFiber.alternate;
  if (previousFiber !== null) {
    let detachedChild = previousFiber.child;
    if (detachedChild !== null) {
      previousFiber.child = null;
      do {
        const detachedSibling: Fiber | null = detachedChild.sibling;
        detachedChild.sibling = null;
        detachedChild = detachedSibling;
      } while (detachedChild !== null);
    }
  }
}

/**
 * 卸载阶段执行副作用 effect 详细流程入口
 * @param finishedWork
 * @param nearestMountedAncestor
 * @param hookFlags
 */
function commitHookPassiveUnmountEffects(
  finishedWork: Fiber,
  nearestMountedAncestor: null | Fiber,
  hookFlags: HookFlags
) {
  commitHookEffectListUnmount(hookFlags, finishedWork, nearestMountedAncestor);
}

/**
 * 卸载阶段 副作用的具体流程 执行updateQueue链表上effect上所有destroy
 * @param flags
 * @param finishedWork
 * @param nearestMountedAncestor
 */
function commitHookEffectListUnmount(
  flags: HookFlags,
  finishedWork: Fiber,
  nearestMountedAncestor: Fiber | null
) {
  const updateQueue: FunctionComponentUpdateQueue = finishedWork.updateQueue;

  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect!;
    do {
      // 判断当前effect的tag是否属于flags中的一种
      if ((effect.tag & flags) === flags) {
        // 卸载阶段
        const inst = effect.inst;
        const destory = inst.destroy;
        if (destory !== undefined) {
          inst.destroy = undefined;
          safelyCallDestroy(finishedWork, nearestMountedAncestor, destory);
        }
      }
      effect = effect.next!;
    } while (effect !== firstEffect);
  }
}

/**
 * 绑定 Ref 的具体实现
 * @param finishedWork
 */
function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = finishedWork.stateNode;
    let instanceToUse;
    switch (finishedWork.tag) {
      case HostComponent:
        instanceToUse = getPublicInstance(instance);
        break;
      default:
        instanceToUse = instance;
    }

    if (typeof ref === "function") {
      finishedWork.refCleanup = ref(instanceToUse);
    } else {
      ref.current = instanceToUse;
    }
  }
}

/**
 * 调用destory回调函数
 * @param current
 * @param nearestMountedAncestor
 * @param destory
 */
function safelyCallDestroy(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  destory: () => void
) {
  try {
    destory();
  } catch (error) {
    console.error(
      "执行destory方法发生错误：",
      current,
      nearestMountedAncestor,
      error
    );
    throw error;
  }
}

/**
 * 绑定Ref
 * @param current
 * @param nearestMountedAncestor
 */
function safelyAttachRef(current: Fiber, nearestMountedAncestor: Fiber | null) {
  try {
    commitAttachRef(current);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * 解绑 Ref
 * @param current
 * @param nearestMountedAncestor
 */
function safelyDetachRef(current: Fiber, nearestMountedAncestor: Fiber | null) {
  const ref = current.ref;
  const refCleanup = current.refCleanup;
  if (ref !== null) {
    if (typeof refCleanup === "function") {
      try {
        refCleanup();
      } catch (error) {
        console.error(error);
        throw error;
      } finally {
        current.refCleanup = null;
        const finishedWork = current.alternate;
        if (finishedWork !== null) {
          finishedWork.refCleanup = null;
        }
      }
    } else if (typeof ref === "function") {
      try {
        ref(null);
      } catch (error) {
        console.error(error);
        throw error;
      }
    } else {
      ref.current = null;
    }
  }
}

function commitHookLayoutEffects(finishedWork: Fiber, hookFlags: HookFlags) {
  try {
    commitHookEffectListMount(hookFlags, finishedWork);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * DFS遍历处理 Layout 阶段
 * @param root
 * @param parentFiber
 * @param lanes
 */
function recursivelyTraverseLayoutEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  lanes: Lanes
) {
  if (parentFiber.subtreeFlags & LayoutMask) {
    let child = parentFiber.child;
    while (child !== null) {
      const current = child.alternate;
      commitLayoutEffectOnFiber(root, current, child, lanes);
      child = child.sibling;
    }
  }
}

/**
 * DFS遍历处理 Layout 卸载阶段
 * @param parentFiber
 */
function recursivelyTraverseDisappearLayoutEffects(parentFiber: Fiber) {
  let child = parentFiber.child;
  while (child !== null) {
    disappearLayoutEffects(child);
    child = child.sibling;
  }
}
