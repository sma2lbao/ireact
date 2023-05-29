import { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE } from "shared/react-symbols";
import { ReactContext } from "shared/react-types";

export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    _threadCount: 0,
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
