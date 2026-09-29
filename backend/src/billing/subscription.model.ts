import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { User } from 'src/user/user.model';
import { PlanId } from './plans';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'incomplete'
  | 'canceled'
  | 'unpaid';

/** Current billing state of one user (one row per user). */
@Table({ tableName: 'Subscription', timestamps: true })
export class Subscription extends Model {
  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: 'free' })
  plan: PlanId;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: 'active' })
  status: SubscriptionStatus;

  @Column({ type: DataType.STRING(16), allowNull: true })
  provider: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  providerCustomerId: string | null;

  @Column({ type: DataType.STRING, allowNull: true, unique: true })
  providerSubscriptionId: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  currentPeriodEnd: Date | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  cancelAtPeriodEnd: boolean;
}

@Table({ tableName: 'ProcessedWebhookEvent', timestamps: true, updatedAt: false })
export class ProcessedWebhookEvent extends Model {
  @Column({ type: DataType.STRING, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  provider: string;
}
