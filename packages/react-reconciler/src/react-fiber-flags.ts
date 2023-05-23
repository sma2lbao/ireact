export type Flags = number;

export const NoFlags = /*                      */ 0b000000000000000000000000000;
export const PerformedWork = /*                */ 0b000000000000000000000000001;
export const Placement = /*                    */ 0b000000000000000000000000010;
export const DidCapture = /*                   */ 0b0000000000000000000010000000;

export const Update = /*                       */ 0b000000000000000000000000100;

export const ChildDeletion = /*                */ 0b000000000000000000000010000;
export const ContentReset = /*                 */ 0b0000000000000000000000100000;

export const Ref = /*                          */ 0b0000000000000000001000000000;
export const Passive = /*                      */ 0b000000000000000100000000000; // 表示当前fiber是否有effect副作用

// These are not really side effects, but we still reuse this field.
export const ForceUpdateForLegacySuspense = /* */ 0b0000000000100000000000000000;

export const StoreConsistency = /*             */ 0b0000000000000100000000000000;

export const BeforeMutationMask = Update;

export const MutationMask = Placement | Update | ChildDeletion | Ref;

export const LayoutMask = Update | Ref;

export const PassiveMask = Passive | ChildDeletion;

// Static tags describe aspects of a fiber that are not specific to a render,
// e.g. a fiber uses a passive effect (even if there are no updates on this particular render).
// This enables us to defer more work in the unmount case,
// since we can defer traversing the tree during layout to look for Passive effects,
// and instead rely on the static flag as a signal that there may be cleanup work.
export const RefStatic = /*                    */ 0b0000001000000000000000000000;
export const LayoutStatic = /*                 */ 0b0000010000000000000000000000;
export const PassiveStatic = /*                */ 0b0000100000000000000000000000;
export const MaySuspendCommit = /*             */ 0b0001000000000000000000000000;

// Union of tags that don't get reset on clones.
// This allows certain concepts to persist without recalculating them,
// e.g. whether a subtree contains passive effects or portals.
export const StaticMask =
  LayoutStatic | PassiveStatic | RefStatic | MaySuspendCommit;
