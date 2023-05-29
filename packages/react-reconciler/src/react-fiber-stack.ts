import { Fiber } from "./react-internal-type";

export type StackCursor<T> = { current: T };

let index = -1;

const valueStack: Array<any> = [];

export function createCursor<T>(defaultValue: T): StackCursor<T> {
  return {
    current: defaultValue,
  };
}

export function isEmpty(): boolean {
  return index === -1;
}

export function push<T>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
  index++;

  valueStack[index] = cursor.current;

  cursor.current = value;
}

export function pop<T>(cursor: StackCursor<T>, fiber: Fiber): void {
  if (index < 0) {
    return;
  }

  cursor.current = valueStack[index];

  valueStack[index] = null;
  index--;
}
