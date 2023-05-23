import { jsx } from "./jsx";
import { ReactSharedInternals } from "./react-shared-internals";

const version = "1.0.0";

const createElement = jsx;

export default {
  version,
  createElement,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: ReactSharedInternals,
};

export { useState, useEffect, useRef } from "./react-hooks";
