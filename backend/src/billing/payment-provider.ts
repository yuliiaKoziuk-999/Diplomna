import { PlanId } from './plans';
import { SubscriptionStatus } from './subscription.model';

/**
 * Provider-neutral view of a subscription. Everything BillingService
 * stores comes from one of these, so adding LiqPay means writing one more
 * PaymentProvider, not touching the billing logic.
 */
export interface SubscriptionSnapshot {
  customerId: string;
  subscriptionId: string;
  /** From provider metadata; lets a webhook find the user before the ids are stored. */
  userId: number | null;
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface InvoiceSummary {
  id: string;
  number: string | null;
  createdAt: Date;
  amount: number;
  currency: string;
  status: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface WebhookResult {
  eventId: string;
  /** null when the event carries no subscription change we care about. */
  snapshot: SubscriptionSnapshot | null;
}

export interface PaymentProvider {
  readonly name: string;
  isConfigured(): boolean;
  createCustomer(userId: number, email: string, name: string): Promise<string>;
  createCheckout(params: {
    customerId: string;
    userId: number;
    plan: PlanId;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;
  /** Snapshot of the subscription a finished checkout created, or null if unpaid. */
  snapshotFromCheckout(sessionId: string): Promise<SubscriptionSnapshot | null>;
  fetchSubscription(subscriptionId: string): Promise<SubscriptionSnapshot>;
  changePlan(subscriptionId: string, plan: PlanId): Promise<SubscriptionSnapshot>;
  setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean): Promise<SubscriptionSnapshot>;
  createPortal(customerId: string, returnUrl: string): Promise<string>;
  listInvoices(customerId: string): Promise<InvoiceSummary[]>;
  /** Verifies the signature; throws on a forged or malformed payload. */
  parseWebhook(rawBody: Buffer, signature: string): Promise<WebhookResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
