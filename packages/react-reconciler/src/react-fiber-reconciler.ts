import { FiberNode } from "./react-fiber";
import { Container } from "react-fiber-host-config";
import { FiberRootNode, createFiberRoot } from "./react-fiber-root";
import { createUpdate, enqueueUpdate } from "./react-fiber-update-queue";
import {
  requestUpdateLane,
  scheduleUpdateOnFiber,
} from "./react-fiber-work-loop";
import { Fiber, FiberRoot } from "./react-internal-type";
import { RootTag } from "./react-root-tags";

/**
 * 暴露给 react-dom 调用
 * @param containerInfo
 * @returns
 */
export function createContainer(containerInfo: Container, tag: RootTag) {
  const initialChildren = null;
  const hydrate = false;
  const root = createFiberRoot(containerInfo, tag, hydrate, initialChildren);
  return root;
}

/**
 * 首屏渲染阶段 render 入口
 * @param element
 * @param container
 * @returns
 */
export function updateContainer(element: unknown, container: FiberRoot) {
  const current = container.current;
  const lane = requestUpdateLane(current);
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
