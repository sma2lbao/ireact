export type HookFlags = number;

export const NoFlags = /*   */ 0b0000;

// 表示副作用是否应该触发。
export const HasEffect = /* */ 0b0001; // 是否触发

// 表示副作用（不是清理）触发的阶段
export const Insertion = /* */ 0b0010;
export const Layout = /*    */ 0b0100; // layout
export const Passive = /*   */ 0b1000; // useEffect
