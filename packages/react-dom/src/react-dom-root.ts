import {
  createContainer,
  updateContainer,
} from "@ireact/reconciler/src/react-fiber-reconciler";
import { ReactElement } from "@ireact/shared/react-element-type";
import { listenToAllSupportedEvents } from "react-dom-bindings/src/events/dom-plugin-event-system";
import { Container } from "react-fiber-host-config";
import { ConcurrentRoot } from "@ireact/reconciler/src/react-root-tags";

export function createRoot(container: Container) {
  const root = createContainer(container, ConcurrentRoot);
  listenToAllSupportedEvents(container as EventTarget);
  return {
    render(element: ReactElement) {
      updateContainer(element, root);
    },
  };
}
