import { parseDecimal } from './recipes.ts';

export function parsePortions(value: string): number | undefined {
  if (!/^\d+(?:[.,]\d{1,2})?$/u.test(value.trim())) return undefined;
  const portions = parseDecimal(value);
  return portions !== undefined && portions > 0 ? portions : undefined;
}

export function scaleAmount(amount: number, portions: number): string {
  const scaled = amount * portions;
  if (!Number.isFinite(scaled)) return 'Hesaplanamıyor';
  if (amount > 0 && portions > 0 && scaled < .01) return '<0.01';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false }).format(scaled);
}

export function scaleCalories(calories: number, portions: number): string {
  const scaled = calories * portions;
  return Number.isFinite(scaled) ? String(Math.round(scaled)) : 'Hesaplanamıyor';
}
