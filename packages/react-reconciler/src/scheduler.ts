import * as Scheduler from "scheduler";

export type SchedulerCallback = (isSync: boolean) => SchedulerCallback | null;

export const shouldYield = Scheduler.unstable_shouldYield;

export const requestPaint = (Scheduler as any).unstable_requestPaint!;

export const scheduleCallback = Scheduler.unstable_scheduleCallback;
export const now = Scheduler.unstable_now;
export const cancelCallback = Scheduler.unstable_cancelCallback;

export const getCurrentPriorityLevel =
  Scheduler.unstable_getCurrentPriorityLevel;

export const ImmediatePriority = Scheduler.unstable_ImmediatePriority; // 最高优先级
export const UserBlockingPriority = Scheduler.unstable_UserBlockingPriority; // 用户阻塞优先级
export const NormalPriority = Scheduler.unstable_NormalPriority; // 默认优先级
export const LowPriority = Scheduler.unstable_LowPriority; // 低优先级
export const IdlePriority = Scheduler.unstable_IdlePriority; // 空闲优先级
