// 为未包装在 startTransition 中的更新添加时间切片选项。仅在禁用 enableSyncDefaultUpdates 时相关。
export const allowConcurrentByDefault = false;

// Need to remove didTimeout argument from Scheduler before landing
export const disableSchedulerTimeoutInWorkLoop = false;

// 这将破坏Meta的一些内部测试，所以我们需要关闭这个，直到这些可以修复。
export const enableDeferRootSchedulingToMicrotask = true;
