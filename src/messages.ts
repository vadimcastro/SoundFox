import type { EqBandsTuple, EqMode, MemoryScope } from "./settings";

export type SoundFoxStateV2 = {
  volume: number;
  eq: EqMode;
  eqBands: EqBandsTuple;
  dialogMode: boolean;
  autoLevel: boolean;
  memoryScope: MemoryScope;
};

export type PopupToContentMessage =
  | { action: "setVolume"; value: number }
  | { action: "setEq"; mode: EqMode }
  | { action: "setEqBands"; bands: EqBandsTuple }
  | { action: "setDialogMode"; active: boolean }
  | { action: "setAutoLevel"; active: boolean }
  | { action: "setMemoryScope"; scope: MemoryScope }
  | { action: "getState" };

