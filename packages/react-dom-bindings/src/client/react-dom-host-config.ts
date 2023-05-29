// import { updateFiberProps } from "./react-dom-component-tree";

import {
  DefaultEventPriority,
  EventPriority,
} from "@ireact/reconciler/src/react-event-priorities";
import { updateFiberProps } from "../events/fake-synthetic-event";
import { getEventPriority } from "../events/react-dom-event-listener";
import { COMMENT_NODE, DOCUMENT_NODE, TEXT_NODE } from "./html-node-type";
import setTextContent from "./set-text-content";

export type Container = Element;

export type Instance = Element;

export type TextInstance = Text;

export type TimeoutHandle = any;
export type NoTimeout = -1;

export const noTimeout = -1;

export const supportsHydration = true;

export const supportsMutation = true;

export const isPrimaryRenderer = true;

export const cancelTimeout: any =
  typeof clearTimeout === "function" ? clearTimeout : undefined;

function getOwnerDocumentFromRootContainer(
  rootContainerElement: Element | Document | DocumentFragment
): Document {
  return rootContainerElement.nodeType === DOCUMENT_NODE
    ? (rootContainerElement as Document)
    : (rootContainerElement.ownerDocument as Document);
}

export const createInstance = (
  type: string,
  props: any
  // rootContainerInstance: Container
): Instance => {
  // const ownerDocument = getOwnerDocumentFromRootContainer(
  //   rootContainerInstance
  // );

  // TODO 处理props
  const element = document.createElement(type);
  updateFiberProps(element as any, props);
  return element;
};

export const createTextInstance = (text: string) => {
  const textNode: TextInstance = document.createTextNode(text);
  return textNode;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

export const commitUpdate = (
  instance: Instance,
  updatePayload: any,
  type: string,
  oldProps: any,
  newProps: any,
  internalInstanceHandle: Object
) => {
  console.warn("未实现");
};

export const commitTextUpdate = (
  instance: TextInstance,
  oldText: string,
  newText: string
) => {
  instance.textContent = newText;
};

export const removeChild = (parentInstance: Instance, child: any) => {
  parentInstance.removeChild(child);
};

export const removeChildFromContainer = (container: Container, child: any) => {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.removeChild(child);
  } else {
    container.removeChild(child);
  }
};

export function insertBefore(
  parentInstance: Instance,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance
): void {
  parentInstance.insertBefore(child, beforeChild);
}

export function insertInContainerBefore(
  container: Container,
  child: Instance | TextInstance,
  beforeChild: Instance | TextInstance
): void {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode?.insertBefore(child, beforeChild);
  } else {
    container.insertBefore(child, beforeChild);
  }
}

export function resetTextContent(domElement: Instance): void {
  setTextContent(domElement, "");
}

export function appendChild(
  parentInstance: Instance,
  child: Instance | TextInstance
): void {
  parentInstance.appendChild(child);
}

export function appendChildToContainer(
  container: Container,
  child: Instance | TextInstance
) {
  let parentNode;
  if (container.nodeType === COMMENT_NODE) {
    parentNode = container.parentNode;
    parentNode?.insertBefore(child, container);
  } else {
    parentNode = container;
    parentNode.appendChild(child);
  }
}

export const scheduleMicrotask =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : typeof Promise === "function"
    ? (callback: any) => Promise.resolve(null).then(callback)
    : setTimeout;

export function getPublicInstance(instance: Instance): Instance {
  return instance;
}

export function getCurrentEventPriority(): EventPriority {
  const currentEvent = window.event;
  if (currentEvent === undefined) {
    return DefaultEventPriority;
  }

  return getEventPriority(currentEvent.type as any);
}

export function resetAfterCommit(containerInfo: Container): void {
  console.warn("TODO: resetAfterCommit");
}

export function prepareForCommit(containerInfo: Container): Object | null {
  console.warn("TODO: prepareForCommit");
  return null;
}
