/**
 * Minimal duration parser (`"15m"`, `"30d"`, `"3600s"`, `"12h"`, or a raw ms number)
 * → milliseconds. Used to compute refresh-token `expiresAt`. JWT `expiresIn` accepts
 * these strings natively, so this is only needed where we need an actual Date.
 */
const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: "${value}"`);
  }
  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";
  return amount * UNIT_MS[unit];
}
