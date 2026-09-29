import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { User } from 'src/user/user.model';

@Table({ tableName: 'ApiKey', timestamps: true })
export class ApiKey extends Model {
  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name: string;

  /** First characters of the key, shown in the cabinet to tell keys apart. */
  @Column({ type: DataType.STRING(20), allowNull: false })
  prefix: string;

  /** SHA-256 of the full key; the key itself is never stored. */
  @Column({ type: DataType.CHAR(64), allowNull: false, unique: true })
  keyHash: string;

  @Column({ type: DataType.DATE, allowNull: true })
  lastUsedAt: Date | null;

  @Column({ type: DataType.DATE, allowNull: true })
  revokedAt: Date | null;
}

export type AnchorStatus = 'pending' | 'anchored';

@Table({ tableName: 'AnchorRecord', timestamps: true })
export class AnchorRecord extends Model {
  @Column({ type: DataType.STRING(32), allowNull: false, unique: true })
  publicId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId: number;

  @ForeignKey(() => ApiKey)
  @Column({ type: DataType.INTEGER, allowNull: true })
  apiKeyId: number | null;

  @Column({ type: DataType.CHAR(64), allowNull: false })
  sha256: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  label: string | null;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
  status: AnchorStatus;

  /** Anchor version in MerkleAnchor.sol that holds this record's batch root. */
  @Column({ type: DataType.INTEGER, allowNull: true })
  epoch: number | null;

  @Column({ type: DataType.STRING(66), allowNull: true })
  batchRoot: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  leafIndex: number | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  siblings: string[] | null;

  @Column({ type: DataType.STRING(66), allowNull: true })
  txHash: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  anchoredAt: Date | null;
}
