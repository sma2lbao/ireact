## useContext 实现

[github 提交地址](https://github.com/sma2lbao/ireact/commit/770857639783e3608cbe5a30a0f0c4f9ecb7d5c8)

### 创建 React.createContext api

```typescript
export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    Provider: null as any,
    Consumer: null as any,
  };
  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };

  context.Consumer = context;
  return context;
}
```

### 创建 Context 结构 以及定义 Symbol 值

```typescript
export type ReactProviderType<T> = {
  $$typeof: symbol | number;
  _context: ReactContext<T>;
  [key: string]: any;
};

export type ReactContext<T> = {
  $$typeof: symbol | number;
  Consumer: ReactContext<T>;
  Provider: ReactProviderType<T>;
  _currentValue: T;
  _currentValue2: T;
  dispalyName?: string;
  [key: string]: any;
};

export const REACT_CONTEXT_TYPE: symbol = Symbol.for("react.context");
export const REACT_PROVIDER_TYPE: symbol = Symbol.for("react.provider");
```

### 在创建 Fiber 加入 ContextProvider 类型

```typescript
export function createFiberFromTypeAndProps() {
  ...
  else if (
    typeof type === "object" &&
    type !== null &&
    type.$$typeof === REACT_PROVIDER_TYPE
  ) {
    fiberTag = ContextProvider;
  }
  ...
}
```

### 在 render（协调）阶段 beginWork 中加入 ContextProvider 的处理

```typescript
beginWork() {
  ...
  case ContextProvider:
    return updateContextProvider(current, workInProgress, renderLanes);
  ...
}

function updateContextProvider(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const providerType: ReactProviderType<any> = workInProgress.type;
  const context: ReactContext<any> = providerType._context;

  const newProps = workInProgress.pendingProps;
  const oldProps = workInProgress.memoizedProps;

  const newValue = newProps.value;

  // context 入栈过程
  pushProvider(workInProgress, context, newValue);

  // TODO  路径优化
  // 从 Provider向下DFS，寻找消费了当前变化的context的consumer
  // 如果找到consumer，从consumer向上遍历到Provider
  // 标记沿途组件存在更新
  // if (oldProps !== null) {
  //   const oldValue = oldProps.value;
  //   if (Object.is(oldValue, newValue)) {
  //     // 没有变化
  //     if (oldProps.children === newProps.children) {
  //       return bailoutOnAlreadyFinishedWork(
  //         current,
  //         workInProgress,
  //         renderLanes
  //       );
  //     }
  //   } else {
  //     // context有变化，找到匹配的consumer 并且调度他们更新
  //     propagateContextChange(workInProgress, context, renderLanes);
  //   }
  // }

  const newChildren = newProps.children;
  reconcileChildren(current, workInProgress, newChildren, renderLanes);
  return workInProgress.child;
}

```

#### 针对 Context 实现入栈出栈功能

```typescript
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
```

### 在 render 阶段的 completeWork 中出栈

```typescript
function completeWork() {
  ...
  case ContextProvider:
      // 出栈过程
      const context: ReactContext<any> = workInProgress.type._context;
      popProvider(context, workInProgress);
      bubbleProperties(workInProgress);
      return null;
  }
  ...
}
```

### 实现 useContext，在 react-fiber-hooks 文件编写从 hook 中获取 context 的值

```typescript
export function readContext<T>(context: ReactContext<T>): T {
  return readContextForConsumer(currentlyRenderingFiber, context);
}

export function readContextForConsumer<T>(
  consumer: Fiber | null,
  context: ReactContext<T>
) {
  const value = context._currentValue;
  return value;
}
```
