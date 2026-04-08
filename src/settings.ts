export const SETTINGS_SCHEMA_VERSION = 2;
export const FALLBACK_SITE_KEY = "__default__";
export const EQ_BAND_FREQUENCIES = [60, 300, 1000, 3000, 12000] as const;
export const DEFAULT_EQ_BANDS: EqBandsTuple = [0, 0, 0, 0, 0];
export const DEFAULT_BASS_EQ_BANDS: EqBandsTuple = [8, 4, 0, 0, 0];

export type EqBandsTuple = [number, number, number, number, number];
export type MemoryScope = "site" | "tab";
export type EqMode = "flat" | "bass";

export type PersistedSettingsV2 = {
  volume?: number;
  eq?: EqMode;
  dialogMode?: boolean;
  autoLevel?: boolean;
  eqBands?: EqBandsTuple;
};

type LegacyTopLevelState = {
  volume?: unknown;
  eq?: unknown;
  dialogMode?: unknown;
  autoLevel?: unknown;
};

type NormalizeSiteSettingsOptions = {
  rawSettings: unknown;
  siteCandidates: string[];
  siteKey: string;
  legacy?: LegacyTopLevelState;
};

export function normalizeHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

export function getSiteStorageCandidates(location: Location): string[] {
  const candidates = new Set<string>();

  try {
    const normalizedHost = normalizeHostname(location.hostname || "");
    if (normalizedHost) {
      candidates.add(normalizedHost);
      const parts = normalizedHost.split(".").filter(Boolean);
      for (let i = 1; i < parts.length - 1; i += 1) {
        candidates.add(parts.slice(i).join("."));
      }
    }
  } catch (e) {}

  try {
    const origin = location.origin;
    if (origin && origin !== "null") {
      candidates.add(`origin:${origin.toLowerCase()}`);
    }
  } catch (e) {}

  candidates.add(FALLBACK_SITE_KEY);
  return Array.from(candidates);
}

export function getPrimarySiteStorageKey(location: Location): string {
  return getSiteStorageCandidates(location)[0] || FALLBACK_SITE_KEY;
}

export function getSettingsMap(value: unknown): Record<string, PersistedSettingsV2> {
  return value && typeof value === "object" ? (value as Record<string, PersistedSettingsV2>) : {};
}

function coerceBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function coerceEq(value: unknown): EqMode | undefined {
  return value === "flat" || value === "bass" ? value : undefined;
}

function coerceVolume(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return undefined;
  return Math.min(6, Math.max(0, value));
}

function coerceEqBands(value: unknown): EqBandsTuple | undefined {
  if (!Array.isArray(value) || value.length !== DEFAULT_EQ_BANDS.length) return undefined;
  const normalized = value.map((entry) => {
    if (typeof entry !== "number" || Number.isNaN(entry) || !Number.isFinite(entry)) return 0;
    return Math.min(12, Math.max(-12, entry));
  });
  return normalized as EqBandsTuple;
}

export function coerceSettings(value: unknown): PersistedSettingsV2 {
  if (!value || typeof value !== "object") return {};
  const source = value as PersistedSettingsV2;
  const volume = coerceVolume(source.volume);
  const eq = coerceEq(source.eq);
  const dialogMode = coerceBoolean(source.dialogMode);
  const autoLevel = coerceBoolean(source.autoLevel);
  const eqBands = coerceEqBands(source.eqBands);
  return { volume, eq, dialogMode, autoLevel, eqBands };
}

export function resolveEqBandsForMode(mode: EqMode | undefined): EqBandsTuple {
  return mode === "bass" ? [...DEFAULT_BASS_EQ_BANDS] : [...DEFAULT_EQ_BANDS];
}

export function hasAnySetting(value: PersistedSettingsV2): boolean {
  return (
    value.volume !== undefined ||
    value.eq !== undefined ||
    value.dialogMode !== undefined ||
    value.autoLevel !== undefined ||
    value.eqBands !== undefined
  );
}

export function getScopedSettings(
  settings: Record<string, PersistedSettingsV2>,
  siteCandidates: string[]
): PersistedSettingsV2 {
  for (const key of siteCandidates) {
    const entry = coerceSettings(settings[key]);
    if (hasAnySetting(entry)) {
      return entry;
    }
  }
  return {};
}

export function normalizeSiteSettings({
  rawSettings,
  siteCandidates,
  siteKey,
  legacy
}: NormalizeSiteSettingsOptions): {
  settingsMap: Record<string, PersistedSettingsV2>;
  scoped: PersistedSettingsV2;
  didMutate: boolean;
} {
  const settingsMap = getSettingsMap(rawSettings);
  let scoped = getScopedSettings(settingsMap, siteCandidates);
  let didMutate = false;

  const legacySettings = coerceSettings({
    volume: legacy?.volume,
    eq: legacy?.eq,
    dialogMode: legacy?.dialogMode,
    autoLevel: legacy?.autoLevel
  });

  if (!hasAnySetting(scoped) && hasAnySetting(legacySettings)) {
    const eqBands = legacySettings.eqBands || resolveEqBandsForMode(legacySettings.eq);
    settingsMap[siteKey] = {
      ...legacySettings,
      eqBands
    };
    scoped = settingsMap[siteKey];
    didMutate = true;
  }

  if (hasAnySetting(scoped) && !scoped.eqBands) {
    const eqBands = resolveEqBandsForMode(scoped.eq);
    settingsMap[siteKey] = {
      ...scoped,
      eqBands
    };
    scoped = settingsMap[siteKey];
    didMutate = true;
  }

  return { settingsMap, scoped, didMutate };
}
