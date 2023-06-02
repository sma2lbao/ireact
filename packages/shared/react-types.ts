export type ReactNode = ReactFragment | ReactConsumer<any>;

export type ReactEmpty = null | void | boolean;

export type ReactFragment = ReactEmpty;

export type ReactNodeList = ReactEmpty;

export type ReactConsumer<T> = {
  $$typeof: symbol | number;
  type: ReactContext<T>;
  key: null | string;
  ref: null;
  props: {
    children: (value: T) => ReactNodeList;
    [key: string]: any;
  };
  [key: string]: any;
};

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

export type StartTransitionOptions = {
  name?: string;
};

export interface Wakeable {
  then(onFulfill: () => any, onReject: () => any): void | Wakeable;
}

interface ThenableImpl<T> {
  then(
    onFulfill: (value: T) => any,
    onReject: (error: any) => any
  ): void | Wakeable;
}
interface UntrackedThenable<T> extends ThenableImpl<T> {
  status?: void;
}

export interface PendingThenable<T> extends ThenableImpl<T> {
  status: "pending";
}

export interface FulfilledThenable<T> extends ThenableImpl<T> {
  status: "fulfilled";
  value: T;
}

export interface RejectedThenable<T> extends ThenableImpl<T> {
  status: "rejected";
  reason: any;
}

export type Thenable<T> =
  | UntrackedThenable<T>
  | PendingThenable<T>
  | FulfilledThenable<T>
  | RejectedThenable<T>;
