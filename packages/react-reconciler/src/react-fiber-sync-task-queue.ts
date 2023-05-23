import { SchedulerCallback } from "./scheduler";

let syncQueue: Array<SchedulerCallback> | null = null;
let isFlushingSyncQueue = false;

/**
 * 微任务调度
 * @param callback
 */
export function scheduleSyncCallback(callback: SchedulerCallback) {
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

/**
 * 执行更新逻辑
 */
export function flushSyncCallbacks() {
  if (!isFlushingSyncQueue && syncQueue !== null) {
    isFlushingSyncQueue = true;
    try {
      const isSync = true;
      syncQueue.forEach((callback) => callback(isSync));
    } catch (error) {
    } finally {
      isFlushingSyncQueue = false;
      syncQueue = null;
    }
  }
}
