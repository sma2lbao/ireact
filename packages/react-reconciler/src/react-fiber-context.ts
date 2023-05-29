import { ReactContext } from "shared/react-types";
import { Fiber } from "./react-internal-type";
import { isPrimaryRenderer } from "react-fiber-host-config";
import { StackCursor, createCursor, pop, push } from "./react-fiber-stack";

const valueCursor: StackCursor<any> = createCursor(null);

/**
 * 入栈 provider
 * @param providerFiber
 * @param context
 * @param nextValue
 */
export function pushProvider<T>(
  providerFiber: Fiber,
  context: ReactContext<T>,
  nextValue: T
): void {
  if (isPrimaryRenderer) {
    push(valueCursor, context._currentValue, providerFiber);
    context._currentValue = nextValue;
  }
}

/**
 * 出栈 provider
 * @param context
 * @param providerFiber
 */
export function popProvider(
  context: ReactContext<any>,
  providerFiber: Fiber
): void {
  const currentValue = valueCursor.current;
  if (isPrimaryRenderer) {
    context._currentValue = currentValue;
  }
  pop(valueCursor, providerFiber);
}
