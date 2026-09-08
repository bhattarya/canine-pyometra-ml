/** Whole-number percent, clamped away from absurd 0 % / 100 % at the extremes. */
export function pct(x: number): string {
  if (x < 0.01) return "<1%";
  if (x > 0.99) return ">99%";
  return `${Math.round(x * 100)}%`;
}

/** Percent with one decimal, for observed rates that are genuinely exact. */
export function pct1(x: number): string {
  return `${(x * 100).toFixed(x === 0 || x === 1 ? 0 : 1)}%`;
}

export const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

export const round = (n: number, dp = 0): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
