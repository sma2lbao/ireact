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
