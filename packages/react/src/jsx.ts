import {
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
} from "@ireact/shared/react-symbols";

const RESERVED_PROPS: Record<string, boolean> = {
  key: true,
  ref: true,
  __self: true,
  __source: true,
};

/**
 *
 * @param type
 * @param key
 * @param {string|object} ref
 * @param self
 * @param source
 * @param owner
 * @param props
 */
const ReactElement = function (type: any, key: any, ref: any, props: any) {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
  };

  return element;
};

/**
 *
 * @param type
 * @param {object} config
 * @param {string} maybeKey
 * @returns
 */
export function jsx(
  type: any,
  config: Record<string, unknown>,
  maybeKey?: any
) {
  const props: Record<string, unknown> = {};
  const key =
    config?.key !== undefined
      ? "" + config.key
      : maybeKey !== undefined
      ? "" + maybeKey
      : null;
  const ref = config?.ref !== undefined ? config.ref : null;

  for (const propName in config) {
    if (
      Object.prototype.hasOwnProperty.call(config, propName) &&
      !Object.prototype.hasOwnProperty.call(RESERVED_PROPS, propName)
    ) {
      props[propName] = config[propName];
    }
  }

  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (const propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  const element = ReactElement(type, key, ref, props);
  return element;
}

export const jsxDEV = jsx;

export const Fragment = REACT_FRAGMENT_TYPE;
