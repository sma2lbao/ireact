import { Container } from "react-fiber-host-config";
import { DOMEventName } from "./dom-event-names";
import { allNativeEvents } from "./event-registry";
import { initEvent } from "./fake-synthetic-event";

const listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);

export function listenToAllSupportedEvents(rootContainerElement: EventTarget) {
  initEvent(rootContainerElement as Container, "click");
  // if (!(rootContainerElement as any)[listeningMarker]) {
  //   (rootContainerElement as any)[listeningMarker] = true;
  //   allNativeEvents.forEach((domEventName) => {
  //     // We handle selectionchange separately because it
  //     // doesn't bubble and needs to be on the document.
  //     listenToNativeEvent(domEventName, true, rootContainerElement);
  //   });
  // }
}
