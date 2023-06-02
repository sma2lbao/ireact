import {
  ReactContext,
  StartTransitionOptions,
} from "@ireact/shared/react-types";
import ReactCurrentDispatcher from "./react-current-dispatcher";
import {
  BasicStateAction,
  Dispatch,
  Dispatcher,
} from "@ireact/reconciler/src/react-internal-type";

function resolveDispatcher(): Dispatcher {
  const dispatcher = ReactCurrentDispatcher.current;

  if (dispatcher === null) {
    throw new Error("dispatcher 不能为空，执行位置有误");
  }

  return dispatcher;
}

export function useState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useEffect(
  create: () => void | (() => void),
  deps: void | null | any[]
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

export function useRef<T>(initialValue: T): { current: T } {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
}

export function useContext<T>(Context: ReactContext<T>): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useContext(Context);
}

export function useTransition(): [
  boolean,
  (callback: () => void, options?: StartTransitionOptions) => void
] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
}
