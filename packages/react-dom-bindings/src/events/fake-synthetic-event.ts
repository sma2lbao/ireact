import { Container } from "react-fiber-host-config";

// 支持的事件类型
const validEventTypeList = ["click"];
export const elementPropsKey = "__props";

type EventCallback = (e: SyntheticEvent) => void;
interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}
interface SyntheticEvent extends Event {
  __stopPropagation: boolean;
}

export interface DOMElement extends Element {
  [elementPropsKey]: {
    [key: string]: any;
  };
}

function createSyntheticEvent(e: Event): SyntheticEvent {
  const syntheticEvent = e as SyntheticEvent;
  syntheticEvent.__stopPropagation = false;
  const originStopPropagation = e.stopPropagation.bind(e);

  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  };

  return syntheticEvent;
}

function getEventCallbackNameFromtEventType(
  eventType: string
): string[] | undefined {
  return {
    click: ["onClickCapture", "onClick"],
  }[eventType];
}

// 将支持的事件回调保存在DOM中
export const updateFiberProps = (node: DOMElement, props: any) => {
  (node as DOMElement)[elementPropsKey] = props;
};

const triggerEventFlow = (paths: EventCallback[], se: SyntheticEvent) => {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    callback.call(null, se);
    if (se.__stopPropagation) {
      break;
    }
  }
};

const dispatchEvent = (container: Container, eventType: string, e: Event) => {
  const targetElement = e.target;

  if (targetElement === null) {
    console.error("事件不存在target", e);
    return;
  }

  const { capture, bubble } = collectPaths(
    targetElement as DOMElement,
    container,
    eventType
  );
  const se = createSyntheticEvent(e);
  triggerEventFlow(capture, se);
  if (!se.__stopPropagation) {
    triggerEventFlow(bubble, se);
  }
};

// 收集从目标元素到HostRoot之间所有目标回调函数
const collectPaths = (
  targetElement: DOMElement,
  container: Container,
  eventType: string
): Paths => {
  const paths: Paths = {
    capture: [],
    bubble: [],
  };
  // 收集事件回调是冒泡的顺序
  while (targetElement && targetElement !== container) {
    const elementProps = targetElement[elementPropsKey];
    if (elementProps) {
      const callbackNameList = getEventCallbackNameFromtEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (i === 0) {
              // 反向插入捕获阶段的事件回调
              paths.capture.unshift(eventCallback);
            } else {
              // 正向插入冒泡阶段的事件回调
              paths.bubble.push(eventCallback);
            }
          }
        });
      }
    }
    targetElement = targetElement.parentNode as DOMElement;
  }
  return paths;
};

export const initEvent = (container: Container, eventType: string) => {
  if (!validEventTypeList.includes(eventType)) {
    console.error("当前不支持", eventType, "事件");
    return;
  }
  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e);
  });
};
