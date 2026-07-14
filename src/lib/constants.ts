// 1 USD = 10 credits (matches $5 = 50 credits, $10 = 100 credits)
export const CREDITS_PER_DOLLAR = 10;

export function usdToCredits(usd: number): number {
  return Math.round(usd * CREDITS_PER_DOLLAR);
}