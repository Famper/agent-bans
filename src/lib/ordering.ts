import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

export function keyBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b);
}

export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  return generateNKeysBetween(a, b, n);
}
