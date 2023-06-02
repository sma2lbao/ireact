import { jsx } from "./jsx";
import { ReactSharedInternals } from "./react-shared-internals";

export const version = "1.0.0";

export const createElement = jsx;

export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED =
  ReactSharedInternals;

export { createContext } from "./react-context";
export {
  useState,
  useEffect,
  useRef,
  useContext,
  useTransition,
} from "./react-hooks";
