import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { createHash, randomBytes } from 'crypto';
import { BillingService } from 'src/billing/billing.service';
import { PLANS } from 'src/billing/plans';
import { AnchoringService } from 'src/verifiable-search/anchoring/anchoring.service';
import { buildMerkleTree, getInclusionProof, hashLeaf } from 'src/verifiable-search/merkle/merkle-tree';
import { AnchorRecord, ApiKey } from './anchor.models';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Anchor API (docs/startup-business-plan.md, section 2.1): clients submit
 * SHA-256 hashes, which wait in a batch until the epoch closes; then one
 * Merkle root per epoch is anchored and every record gets its own proof.
 * Leaf = hashLeaf(sha256 hex), same keccak/sorted-pair tree as
 * verifiable-search, so verification-sdk checks these receipts unchanged.
 */
@Injectable()
export class AnchorApiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnchorApiService.name);
  private timer: NodeJS.Timeout | null = null;
  private closing = false;

  constructor(
    @InjectModel(AnchorRecord) private readonly records: typeof AnchorRecord,
    @InjectModel(ApiKey) private readonly keys: typeof ApiKey,
    private readonly billing: BillingService,
    private readonly anchoring: AnchoringService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const every = Number(this.config.get('ANCHOR_EPOCH_MS')) || 60_000;
    this.timer = setInterval(() => void this.closeEpoch(), every);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /* ---------- records ---------- */

  async submit(userId: number, hash: string, label: string | null, apiKeyId: number | null) {
    const plan = await this.billing.planFor(userId);
    const limit = PLANS[plan].anchorsPerMonth;
    if (limit !== null && (await this.billing.anchorsThisMonth(userId)) >= limit) {
      throw new ForbiddenException(
        `Ліміт тарифу ${PLANS[plan].name} (${limit} анкорів на місяць) вичерпано. Оновіть тариф у кабінеті.`,
      );
    }
    const record = await this.records.create({
      publicId: 'anc_' + randomBytes(12).toString('hex'),
      userId,
      apiKeyId,
      sha256: hash.toLowerCase(),
      label,
    });
    return this.toDto(record);
  }

  async list(userId: number, limit = 50) {
    const rows = await this.records.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
    });
    return rows.map((r) => this.toDto(r));
  }

  async receipt(publicId: string, userId?: number) {
    const record = await this.records.findOne({ where: { publicId } });
    if (!record || (userId !== undefined && record.userId !== userId)) {
      throw new NotFoundException('Квитанцію не знайдено');
    }
    return this.toDto(record);
  }

  private toDto(r: AnchorRecord) {
    const base = {
      id: r.publicId,
      sha256: r.sha256,
      label: r.label,
      status: r.status,
      createdAt: r.createdAt,
    };
    if (r.status !== 'anchored') return base;
    return {
      ...base,
      anchoredAt: r.anchoredAt,
      receipt: {
        type: 'document-receipt',
        v: 1,
        sha256: r.sha256,
        leaf: hashLeaf(r.sha256),
        leafRule: 'keccak256(utf8(sha256 hex))',
        epoch: r.epoch,
        batchRoot: r.batchRoot,
        leafIndex: r.leafIndex,
        siblings: r.siblings,
        txHash: r.txHash,
        network: 'mock', // becomes polygon-amoy once MerkleAnchor.sol is deployed
      },
    };
  }

  /** Public: the anchored root of a document epoch, for independent receipt checks. */
  epochRoot(epoch: number) {
    const anchor = this.anchoring.getRoot(epoch, 'documents');
    if (!anchor) throw new NotFoundException('Епоху не знайдено');
    return anchor;
  }

  /** Batches every pending record into one Merkle tree and anchors its root. */
  async closeEpoch(): Promise<{ anchored: number; epoch?: number }> {
    if (this.closing) return { anchored: 0 };
    this.closing = true;
    try {
      const pending = await this.records.findAll({
        where: { status: 'pending' },
        order: [['id', 'ASC']],
        limit: 10_000,
      });
      if (pending.length === 0) return { anchored: 0 };
      const tree = buildMerkleTree(pending.map((r) => hashLeaf(r.sha256)));
      const anchor = this.anchoring.anchorRoot(tree.root, 'documents');
      const anchoredAt = new Date(anchor.timestamp);
      await this.records.sequelize.transaction(async (transaction) => {
        for (let i = 0; i < pending.length; i++) {
          const { siblings } = getInclusionProof(tree.layers, i);
          await pending[i].update(
            {
              status: 'anchored',
              epoch: anchor.version,
              batchRoot: tree.root,
              leafIndex: i,
              siblings,
              txHash: anchor.txHash,
              anchoredAt,
            },
            { transaction },
          );
        }
      });
      this.logger.log(`epoch ${anchor.version}: anchored ${pending.length} records`);
      return { anchored: pending.length, epoch: anchor.version };
    } finally {
      this.closing = false;
    }
  }

  /* ---------- API keys ---------- */

  async createKey(userId: number, name: string) {
    const secret = 'ap_test_' + randomBytes(24).toString('hex');
    const key = await this.keys.create({
      userId,
      name,
      prefix: secret.slice(0, 16),
      keyHash: sha256(secret),
    });
    // The only time the full key leaves the server.
    return { ...this.keyDto(key), secret };
  }

  async listKeys(userId: number) {
    const keys = await this.keys.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    return keys.map((k) => this.keyDto(k));
  }

  async revokeKey(userId: number, id: number) {
    const key = await this.keys.findOne({ where: { id, userId } });
    if (!key) throw new NotFoundException('Ключ не знайдено');
    if (!key.revokedAt) await key.update({ revokedAt: new Date() });
    return this.keyDto(key);
  }

  async authenticateKey(secret: string): Promise<ApiKey | null> {
    const key = await this.keys.findOne({ where: { keyHash: sha256(secret) } });
    if (!key || key.revokedAt) return null;
    await key.update({ lastUsedAt: new Date() });
    return key;
  }

  private keyDto(k: ApiKey) {
    return {
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
    };
  }
}
