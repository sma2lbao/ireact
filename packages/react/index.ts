import { jsx } from "./src/jsx";
import { ReactSharedInternals } from "./src/react-shared-internals";
import { useState, useEffect, useRef } from "./src/react-hooks";

const version = "1.0.0";

const createElement = jsx;

export default {
  version,
  createElement,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: ReactSharedInternals,
  useState,
  useEffect,
  useRef,
};

export { useState, useEffect, useRef } from "./src/react-hooks";
