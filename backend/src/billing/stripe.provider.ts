import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PLANS, PlanId, PAID_PLANS } from './plans';
import { SubscriptionStatus } from './subscription.model';
import {
  InvoiceSummary,
  PaymentProvider,
  SubscriptionSnapshot,
  WebhookResult,
} from './payment-provider';

const STATUS: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  unpaid: 'unpaid',
  paused: 'unpaid',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  canceled: 'canceled',
};

const idOf = (v: string | { id: string } | null): string | null =>
  v == null ? null : typeof v === 'string' ? v : v.id;

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key?.startsWith('sk_live_') && process.env.NODE_ENV !== 'production') {
      this.logger.warn('Live Stripe key outside production: billing disabled');
    } else if (key) {
      this.client = new Stripe(key);
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private get stripe(): Stripe {
    if (!this.client) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY)');
    return this.client;
  }

  private priceFor(plan: PlanId): string {
    const env = PLANS[plan].priceEnv;
    const price = env && this.config.get<string>(env);
    if (!price) throw new Error(`No Stripe price for plan "${plan}" (run npm run stripe:setup)`);
    return price;
  }

  private planForPrice(priceId: string, fallback?: string): PlanId {
    const plan = PAID_PLANS.find((p) => this.config.get<string>(PLANS[p].priceEnv) === priceId);
    if (plan) return plan;
    if (fallback && (PAID_PLANS as string[]).includes(fallback)) return fallback as PlanId;
    throw new Error(`Stripe price ${priceId} does not match any plan`);
  }

  private snapshot(sub: Stripe.Subscription): SubscriptionSnapshot {
    const item = sub.items.data[0];
    const userId = Number(sub.metadata?.userId);
    return {
      customerId: idOf(sub.customer),
      subscriptionId: sub.id,
      userId: Number.isFinite(userId) && userId > 0 ? userId : null,
      plan: this.planForPrice(item.price.id, sub.metadata?.plan),
      status: STATUS[sub.status],
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  }

  async createCustomer(userId: number, email: string, name: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: { userId: String(userId) },
    });
    return customer.id;
  }

  async createCheckout(params: {
    customerId: string;
    userId: number;
    plan: PlanId;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const metadata = { userId: String(params.userId), plan: params.plan };
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      client_reference_id: String(params.userId),
      line_items: [{ price: this.priceFor(params.plan), quantity: 1 }],
      allow_promotion_codes: true,
      metadata,
      subscription_data: { metadata },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
    return session.url;
  }

  async snapshotFromCheckout(sessionId: string): Promise<SubscriptionSnapshot | null> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    if (session.status !== 'complete' || !session.subscription) return null;
    const sub =
      typeof session.subscription === 'string'
        ? await this.stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
    return this.snapshot(sub);
  }

  async fetchSubscription(subscriptionId: string): Promise<SubscriptionSnapshot> {
    return this.snapshot(await this.stripe.subscriptions.retrieve(subscriptionId));
  }

  async changePlan(subscriptionId: string, plan: PlanId): Promise<SubscriptionSnapshot> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    const updated = await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: sub.items.data[0].id, price: this.priceFor(plan) }],
      proration_behavior: 'create_prorations',
      cancel_at_period_end: false,
      metadata: { ...sub.metadata, plan },
    });
    return this.snapshot(updated);
  }

  async setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean): Promise<SubscriptionSnapshot> {
    const updated = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancel,
    });
    return this.snapshot(updated);
  }

  async createPortal(customerId: string, returnUrl: string): Promise<string> {
    const configuration = this.config.get<string>('STRIPE_PORTAL_CONFIG') || undefined;
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      configuration,
    });
    return session.url;
  }

  async listInvoices(customerId: string): Promise<InvoiceSummary[]> {
    const invoices = await this.stripe.invoices.list({ customer: customerId, limit: 24 });
    return invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      createdAt: new Date(inv.created * 1000),
      amount: inv.total / 100,
      currency: inv.currency,
      status: inv.status ?? 'draft',
      hostedUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
    }));
  }

  async parseWebhook(rawBody: Buffer, signature: string): Promise<WebhookResult> {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return { eventId: event.id, snapshot: this.snapshot(event.data.object) };
      case 'checkout.session.completed': {
        const subId = idOf(event.data.object.subscription);
        return { eventId: event.id, snapshot: subId ? await this.fetchSubscription(subId) : null };
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const subId = idOf(event.data.object.subscription);
        return { eventId: event.id, snapshot: subId ? await this.fetchSubscription(subId) : null };
      }
      default:
        return { eventId: event.id, snapshot: null };
    }
  }
}
