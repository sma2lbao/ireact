import { Lanes } from "./react-fiber-lane";
import { Fiber } from "./react-internal-type";

export function unwindInterruptedWork(
  current: Fiber | null,
  interruptedWork: Fiber,
  renderLanes: Lanes
) {
  console.warn("TODO: unwindInterruptedWork");
}
