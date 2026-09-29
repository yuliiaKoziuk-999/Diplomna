import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeProvider } from './stripe.provider';

const WEBHOOK_SECRET = 'whsec_test_secret';
const env: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_BUSINESS: 'price_business',
  STRIPE_PRICE_SEARCH: 'price_search',
};
const config = { get: (k: string) => env[k] } as unknown as ConfigService;

function subscriptionEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'evt_1',
    object: 'event',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        object: 'subscription',
        customer: 'cus_1',
        status: 'past_due',
        cancel_at_period_end: true,
        current_period_end: 1_900_000_000,
        metadata: { userId: '42', plan: 'business' },
        items: { data: [{ id: 'si_1', price: { id: 'price_business' } }] },
        ...overrides,
      },
    },
  };
}

function signed(payload: object) {
  const body = JSON.stringify(payload);
  const header = new Stripe('sk_test_dummy').webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET,
  });
  return { raw: Buffer.from(body), header };
}

describe('StripeProvider.parseWebhook', () => {
  const provider = new StripeProvider(config);

  it('maps a signed subscription event to a snapshot', async () => {
    const { raw, header } = signed(subscriptionEvent());
    const { eventId, snapshot } = await provider.parseWebhook(raw, header);
    expect(eventId).toBe('evt_1');
    expect(snapshot).toEqual({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      userId: 42,
      plan: 'business',
      status: 'past_due',
      currentPeriodEnd: new Date(1_900_000_000 * 1000),
      cancelAtPeriodEnd: true,
    });
  });

  it('treats an expired incomplete subscription as canceled', async () => {
    const { raw, header } = signed(subscriptionEvent({ status: 'incomplete_expired' }));
    expect((await provider.parseWebhook(raw, header)).snapshot.status).toBe('canceled');
  });

  it('rejects a payload whose signature does not match', async () => {
    const { header } = signed(subscriptionEvent());
    const tampered = Buffer.from(JSON.stringify(subscriptionEvent({ metadata: { userId: '1' } })));
    await expect(provider.parseWebhook(tampered, header)).rejects.toThrow();
  });

  it('ignores event types that carry no subscription change', async () => {
    const { raw, header } = signed({ id: 'evt_2', object: 'event', type: 'customer.created', data: { object: {} } });
    expect(await provider.parseWebhook(raw, header)).toEqual({ eventId: 'evt_2', snapshot: null });
  });
});

describe('StripeProvider configuration', () => {
  it('refuses live keys outside production', () => {
    const live = { get: (k: string) => (k === 'STRIPE_SECRET_KEY' ? 'sk_live_x' : env[k]) } as unknown as ConfigService;
    expect(new StripeProvider(live).isConfigured()).toBe(false);
  });
});
