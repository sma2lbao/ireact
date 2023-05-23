import { Instance, TextInstance } from "./react-dom-host-config";

const randomKey = Math.random().toString(36).slice(2);
const internalPropsKey = "__reactProps$" + randomKey;

export function updateFiberProps(
  node: Instance | TextInstance,
  props: any
): void {
  (node as any)[internalPropsKey] = props;
}
