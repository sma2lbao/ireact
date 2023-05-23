import { Dispatcher } from "@ireact/reconciler/src/react-internal-type";

const ReactCurrentDispatcher: { current: null | Dispatcher } = {
  current: null,
};

export default ReactCurrentDispatcher;
