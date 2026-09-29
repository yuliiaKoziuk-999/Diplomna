import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { User } from 'src/user/user.model';
import { AnchorRecord } from 'src/anchor-api/anchor.models';
import { PLANS, PlanId } from './plans';
import { ProcessedWebhookEvent, Subscription } from './subscription.model';
import { PAYMENT_PROVIDER, PaymentProvider, SubscriptionSnapshot } from './payment-provider';

const LIVE_STATUSES = ['active', 'trialing', 'past_due'];

export interface BillingOverview {
  plan: PlanId;
  planName: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasPaymentAccount: boolean;
  billingEnabled: boolean;
  usage: { anchorsThisMonth: number; anchorsLimit: number | null; periodStart: Date };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectModel(Subscription) private readonly subscriptions: typeof Subscription,
    @InjectModel(ProcessedWebhookEvent) private readonly events: typeof ProcessedWebhookEvent,
    @InjectModel(AnchorRecord) private readonly anchors: typeof AnchorRecord,
    @InjectModel(User) private readonly users: typeof User,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly config: ConfigService,
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  private requireProvider(): void {
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException(
        'Оплату ще не налаштовано: додайте STRIPE_SECRET_KEY у backend/.env.local',
      );
    }
  }

  private async row(userId: number): Promise<Subscription> {
    const [row] = await this.subscriptions.findOrCreate({ where: { userId } });
    return row;
  }

  /** The plan a user is entitled to right now; unpaid or ended subscriptions fall back to free. */
  effectivePlan(row: Subscription): PlanId {
    return row.plan !== 'free' && LIVE_STATUSES.includes(row.status) ? row.plan : 'free';
  }

  async planFor(userId: number): Promise<PlanId> {
    return this.effectivePlan(await this.row(userId));
  }

  private monthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  async anchorsThisMonth(userId: number): Promise<number> {
    return this.anchors.count({
      where: { userId, createdAt: { [Op.gte]: this.monthStart() } },
    });
  }

  async overview(userId: number, refresh = false): Promise<BillingOverview> {
    let row = await this.row(userId);
    if (refresh && row.providerSubscriptionId && this.provider.isConfigured()) {
      try {
        await this.apply(await this.provider.fetchSubscription(row.providerSubscriptionId));
        row = await row.reload();
      } catch (err) {
        this.logger.warn(`refresh failed for user ${userId}: ${err.message}`);
      }
    }
    const plan = this.effectivePlan(row);
    return {
      plan,
      planName: PLANS[plan].name,
      status: row.plan === 'free' ? 'active' : row.status,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      hasPaymentAccount: !!row.providerCustomerId,
      billingEnabled: this.provider.isConfigured(),
      usage: {
        anchorsThisMonth: await this.anchorsThisMonth(userId),
        anchorsLimit: PLANS[plan].anchorsPerMonth,
        periodStart: this.monthStart(),
      },
    };
  }

  /** Returns a checkout URL, or switches an existing paid subscription in place. */
  async checkout(userId: number, plan: PlanId): Promise<{ url?: string; overview?: BillingOverview }> {
    this.requireProvider();
    const row = await this.row(userId);
    if (row.providerSubscriptionId && LIVE_STATUSES.concat('incomplete').includes(row.status)) {
      if (row.plan === plan && !row.cancelAtPeriodEnd) {
        throw new BadRequestException('Цей тариф уже активний');
      }
      await this.apply(await this.provider.changePlan(row.providerSubscriptionId, plan));
      return { overview: await this.overview(userId) };
    }
    if (!row.providerCustomerId) {
      const user = await this.users.findByPk(userId);
      if (!user) throw new NotFoundException('Користувача не знайдено');
      row.providerCustomerId = await this.provider.createCustomer(userId, user.email, user.fullname);
      row.provider = this.provider.name;
      await row.save();
    }
    const url = await this.provider.createCheckout({
      customerId: row.providerCustomerId,
      userId,
      plan,
      successUrl: `${this.frontendUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${this.frontendUrl}/pricing?checkout=cancel`,
    });
    return { url };
  }

  /** Fallback for local runs without the webhook listener: sync right after the redirect back. */
  async confirmCheckout(userId: number, sessionId: string): Promise<BillingOverview> {
    this.requireProvider();
    const row = await this.row(userId);
    const snapshot = await this.provider.snapshotFromCheckout(sessionId);
    if (snapshot) {
      if (snapshot.customerId !== row.providerCustomerId) {
        throw new BadRequestException('Ця оплата належить іншому акаунту');
      }
      await this.apply(snapshot);
    }
    return this.overview(userId);
  }

  async setCancel(userId: number, cancel: boolean): Promise<BillingOverview> {
    this.requireProvider();
    const row = await this.row(userId);
    if (!row.providerSubscriptionId) throw new BadRequestException('Немає платної підписки');
    await this.apply(await this.provider.setCancelAtPeriodEnd(row.providerSubscriptionId, cancel));
    return this.overview(userId);
  }

  async portal(userId: number): Promise<{ url: string }> {
    this.requireProvider();
    const row = await this.row(userId);
    if (!row.providerCustomerId) throw new BadRequestException('Спершу оформіть платний тариф');
    return { url: await this.provider.createPortal(row.providerCustomerId, `${this.frontendUrl}/account`) };
  }

  async invoices(userId: number) {
    const row = await this.row(userId);
    if (!row.providerCustomerId || !this.provider.isConfigured()) return [];
    return this.provider.listInvoices(row.providerCustomerId);
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    this.requireProvider();
    let result;
    try {
      result = await this.provider.parseWebhook(rawBody, signature);
    } catch (err) {
      throw new BadRequestException(`Webhook rejected: ${err.message}`);
    }
    if (await this.events.findByPk(result.eventId)) return;
    if (result.snapshot) await this.apply(result.snapshot);
    await this.events.findOrCreate({
      where: { id: result.eventId },
      defaults: { id: result.eventId, provider: this.provider.name },
    });
  }

  /** Writes a provider snapshot onto the user's row. */
  private async apply(s: SubscriptionSnapshot): Promise<void> {
    const row =
      (await this.subscriptions.findOne({ where: { providerSubscriptionId: s.subscriptionId } })) ??
      (await this.subscriptions.findOne({ where: { providerCustomerId: s.customerId } })) ??
      (s.userId ? await this.row(s.userId) : null);
    if (!row) {
      this.logger.warn(`no user for subscription ${s.subscriptionId}`);
      return;
    }
    // A late event about an old, replaced subscription must not wipe the new one.
    if (row.providerSubscriptionId && row.providerSubscriptionId !== s.subscriptionId && s.status === 'canceled') {
      return;
    }
    row.provider = this.provider.name;
    row.providerCustomerId = s.customerId;
    if (s.status === 'canceled') {
      Object.assign(row, {
        plan: 'free',
        status: 'active',
        providerSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    } else {
      Object.assign(row, {
        plan: s.plan,
        status: s.status,
        providerSubscriptionId: s.subscriptionId,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      });
    }
    await row.save();
  }
}
