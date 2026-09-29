export type PlanId = 'free' | 'pro' | 'business' | 'search';

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  /** Anchored documents per calendar month; null = unlimited. */
  anchorsPerMonth: number | null;
  /** Env var holding the provider's price id; null for the free plan. */
  priceEnv: string | null;
  features: string[];
}

/** Pricing from docs/startup-business-plan.md, section 3. */
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    anchorsPerMonth: 100,
    priceEnv: null,
    features: ['100 анкорів на місяць', 'Спільний батч', 'Відкритий верифікатор'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceUsd: 49,
    anchorsPerMonth: 50_000,
    priceEnv: 'STRIPE_PRICE_PRO',
    features: ['До 50 000 анкорів', 'API-ключі', 'Квитанції в кабінеті'],
  },
  business: {
    id: 'business',
    name: 'Business',
    priceUsd: 499,
    anchorsPerMonth: null,
    priceEnv: 'STRIPE_PRICE_BUSINESS',
    features: ['Без ліміту анкорів', 'SLA 99,9 %', 'Аудит-лог'],
  },
  search: {
    id: 'search',
    name: 'Verifiable Search',
    priceUsd: 999,
    anchorsPerMonth: null,
    priceEnv: 'STRIPE_PRICE_SEARCH',
    features: ['Усе з Business', 'Квитанції повноти пошуку', 'Звіти для аудиту'],
  },
};

export const PAID_PLANS: PlanId[] = ['pro', 'business', 'search'];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLANS;
}
