import { DOMEventName } from "./dom-event-names";

export const allNativeEvents: Set<DOMEventName> = new Set();

/**
 * Mapping from registration name to event name
 */
export const registrationNameDependencies: {
  [registrationName: string]: Array<DOMEventName>;
} = {};

export function registerTwoPhaseEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>
): void {
  registerDirectEvent(registrationName, dependencies);
  registerDirectEvent(registrationName + "Capture", dependencies);
}

export function registerDirectEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>
) {
  registrationNameDependencies[registrationName] = dependencies;
  for (let i = 0; i < dependencies.length; i++) {
    allNativeEvents.add(dependencies[i]);
  }
}
