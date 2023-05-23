import {
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
} from "@ireact/shared/react-symbols";
import { Lanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-type";
import { ReactElement } from "@ireact/shared/react-element-type";
import {
  createFiberFromElement,
  createFiberFromFragment,
  createFiberFromText,
  createWorkInProgress,
} from "./react-fiber";
import { ChildDeletion, Placement } from "./react-fiber-flags";
import { Fragment, HostText } from "./react-work-tag";

export function resetChildReconcilerOnUnwind(): void {
  console.warn("TODO: resetChildReconcilerOnUnwind");
}

function createChildReconciler(shouldTrackSideEffects: boolean) {
  function deleteRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null
  ) {
    if (!shouldTrackSideEffects) return null;
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function useFiber(fiber: Fiber, pendingProps: any): Fiber {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  function mapRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber
  ): Map<string | number, Fiber> {
    const existingChildren: Map<string | number, Fiber> = new Map();

    let existingChild: null | Fiber = currentFirstChild;
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild);
      } else {
        existingChildren.set(existingChild.index, existingChild);
      }
      existingChild = existingChild.sibling;
    }
    return existingChildren;
  }

  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string,
    lanes: Lanes
  ) {
    if (current === null || current.tag !== HostText) {
      // Insert
      const created = createFiberFromText(textContent, returnFiber.mode, lanes);
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, textContent);
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement,
    lanes: Lanes
  ): Fiber {
    if (element.type === REACT_FRAGMENT_TYPE) {
      return updateFragment(
        returnFiber,
        current,
        element.props.children,
        lanes,
        element.key
      );
    }
    if (current !== null) {
      // 可复用
      if (current.type === element.type) {
        // Move based on index
        const existing = useFiber(current, element.props);
        existing.ref = coerceRef(returnFiber, current, element);
        existing.return = returnFiber;
        return existing;
      }
    }
    // Insert
    const created = createFiberFromElement(element, returnFiber.mode, lanes);
    created.ref = coerceRef(returnFiber, current!, element);
    created.return = returnFiber;
    return created;
  }

  function updateFragment(
    returnFiber: Fiber,
    current: Fiber | null,
    fragment: Iterable<any>,
    lanes: Lanes,
    key: null | string
  ): Fiber {
    if (current === null || current.tag !== Fragment) {
      // Insert
      const created = createFiberFromFragment(
        fragment as any,
        returnFiber.mode,
        lanes,
        key
      );
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, fragment);
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: any,
    lanes: Lanes
  ) {
    // HostText
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      const matchedFiber = existingChildren.get(newIdx) || null;
      return updateTextNode(returnFiber, matchedFiber, "" + newChild, lanes);
    }

    // ReactElement
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key
            ) || null;
          return updateElement(returnFiber, matchedFiber, newChild, lanes);
        }
      }

      if (Array.isArray(newChild)) {
        const matchedFiber = existingChildren.get(newIdx) || null;
        return updateFragment(returnFiber, matchedFiber, newChild, lanes, null);
      }
    }

    return null;
  }

  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number
  ): number {
    newFiber.index = newIndex;

    const current = newFiber.alternate;
    if (current !== null) {
      // 可复用Fiber
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // 老位置比当前已遍历可复用Fiber的位置靠前, 但是新的遍历顺序是从小到大的，因此当前的newFiber相对位置从开始的靠前变成了靠后
        newFiber.flags |= Placement;
        return lastPlacedIndex;
      } else {
        return oldIndex;
      }
    } else {
      // 没有复用
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    }
  }

  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<any>,
    lanes: Lanes
  ): Fiber | null {
    // 创建的第一个Fiber
    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    // 记录curren中最后一个可复用Fiber的索引
    let lastPlacedIndex = 0;

    // 1. 将current children 保存在map中
    const existingChildren = mapRemainingChildren(
      returnFiber,
      currentFirstChild!
    );
    // 2. 遍历newChildren
    for (let newIdx = 0; newIdx < newChildren.length; newIdx++) {
      // 1.寻找可复用
      // 2.标记插入还是移动
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        lanes
      );

      if (newFiber !== null) {
        // 比较可复用Fiber的current中的相对位置
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

        //建立sibing链接
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    // 3. 将剩余的删除
    if (shouldTrackSideEffects) {
      existingChildren.forEach((child) => deleteChild(returnFiber, child));
    }

    return resultingFirstChild;
  }

  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement,
    lanes: Lanes
  ): Fiber {
    const key = element.key;
    let child = currentFirstChild;
    while (child !== null) {
      // 更新阶段
      if (child.key === key) {
        // key 相同
        if (element.type === REACT_FRAGMENT_TYPE) {
          if (child.tag === Fragment) {
            deleteRemainingChildren(returnFiber, child.sibling);
            const existing = useFiber(child, element.props.children);
            existing.return = returnFiber;
            return existing;
          }
        } else {
          if (child.type === element.type) {
            deleteRemainingChildren(returnFiber, child.sibling);
            // type相同
            const existing = useFiber(child, element.props);
            existing.ref = coerceRef(returnFiber, child, element);
            existing.return = returnFiber;
            // 当前节点可复用，标记其他兄弟节点删除
            return existing;
          }
        }
        // 否则type不同则删除所有旧的
        deleteRemainingChildren(returnFiber, child);
        break;
      } else {
        // key不同 删除旧的
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    if (element.type === REACT_FRAGMENT_TYPE) {
      const created = createFiberFromFragment(
        element.props.children,
        returnFiber.mode,
        lanes,
        element.key
      );
      created.return = returnFiber;
      return created;
    } else {
      // 根据 element 生成 Fiber
      const created = createFiberFromElement(element, returnFiber.mode, lanes);
      created.ref = coerceRef(returnFiber, currentFirstChild!, element);
      created.return = returnFiber;
      return created;
    }
  }

  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string,
    lanes: Lanes
  ): Fiber {
    // update
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      // 类型相同需要复用
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      const existing = useFiber(currentFirstChild, textContent);
      existing.return = returnFiber;
      return existing;
    }

    deleteRemainingChildren(returnFiber, currentFirstChild!);

    const created = createFiberFromText(textContent, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  }

  function placeSingleChild(newFiber: Fiber): Fiber {
    // 首屏渲染下
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement;
    }
    return newFiber;
  }

  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    // fragment
    const isUnkeyedTopLevelFragment =
      typeof newChild === "object" &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null;
    if (isUnkeyedTopLevelFragment) {
      newChild = newChild.props.children;
    }

    // 单节点
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            )
          );
        default:
          if (__DEV__) {
            console.warn("未实现的 child 类型");
          }
          break;
      }
    }
    // TODO 多节点
    if (Array.isArray(newChild)) {
      return reconcileChildrenArray(
        returnFiber,
        currentFirstChild,
        newChild,
        lanes
      );
    }

    // 文本节点
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      return placeSingleChild(
        reconcileSingleTextNode(
          returnFiber,
          currentFirstChild,
          "" + newChild,
          lanes
        )
      );
    }

    if (__DEV__) {
      console.warn("未实现的 child 类型");
    }
    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }
  return reconcileChildFibers;
}

export const reconcileChildFibers = createChildReconciler(true);
export const mountChildFibers = createChildReconciler(false);

export function cloneChildFibers(
  current: Fiber | null,
  workInProgress: Fiber
): void {
  if (current !== null && workInProgress.child !== current.child) {
    throw new Error("Resuming work not yet implemented.");
  }

  if (workInProgress.child === null) {
    return;
  }

  let currentChild = workInProgress.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;

  newChild.return = workInProgress;
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps
    );
    newChild.return = workInProgress;
  }
  newChild.sibling = null;
}

function coerceRef(returnFiber: Fiber, current: Fiber, element: ReactElement) {
  const mixedRef = element.ref;
  if (
    mixedRef !== null &&
    typeof mixedRef !== "function" &&
    typeof mixedRef !== "object"
  ) {
    throw new Error(
      "Expected ref to be a function, a string, an object returned by React.createRef()"
    );
  }
  return mixedRef;
}
