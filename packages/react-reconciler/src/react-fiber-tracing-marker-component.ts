import { Fiber } from "./react-internal-type";

export type Transition = {
  name: string;
  startTime: number;
};

export type BatchConfigTransition = {
  name?: string;
  startTime?: number;
  _updatedFibers?: Set<Fiber>;
};
