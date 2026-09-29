-- Billing (subscriptions), API keys and the Anchor API.
-- Applied by `npm run migrate` (scripts/migrate.js). Sequelize runs with
-- synchronize: false, so schema changes live here, not in the models.

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"                     SERIAL PRIMARY KEY,
  "userId"                 INTEGER NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "plan"                   VARCHAR(32)  NOT NULL DEFAULT 'free',
  "status"                 VARCHAR(32)  NOT NULL DEFAULT 'active',
  "provider"               VARCHAR(16),
  "providerCustomerId"     VARCHAR(255),
  "providerSubscriptionId" VARCHAR(255) UNIQUE,
  "currentPeriodEnd"       TIMESTAMPTZ,
  "cancelAtPeriodEnd"      BOOLEAN      NOT NULL DEFAULT FALSE,
  "createdAt"              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "Subscription_providerCustomerId_idx" ON "Subscription" ("providerCustomerId");

-- Webhook idempotency: providers retry deliveries, each event is applied once.
CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
  "id"        VARCHAR(255) PRIMARY KEY,
  "provider"  VARCHAR(16)  NOT NULL,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Only a SHA-256 of the key is stored; the plain key is shown once on creation.
CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id"         SERIAL PRIMARY KEY,
  "userId"     INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"       VARCHAR(100) NOT NULL,
  "prefix"     VARCHAR(20)  NOT NULL,
  "keyHash"    CHAR(64)     NOT NULL UNIQUE,
  "lastUsedAt" TIMESTAMPTZ,
  "revokedAt"  TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey" ("userId");

-- One row per anchored document hash. Pending until the next epoch closes,
-- then carries its Merkle proof against the anchored batch root.
CREATE TABLE IF NOT EXISTS "AnchorRecord" (
  "id"         SERIAL PRIMARY KEY,
  "publicId"   VARCHAR(32)  NOT NULL UNIQUE,
  "userId"     INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "apiKeyId"   INTEGER REFERENCES "ApiKey"("id") ON DELETE SET NULL,
  "sha256"     CHAR(64)     NOT NULL,
  "label"      VARCHAR(255),
  "status"     VARCHAR(16)  NOT NULL DEFAULT 'pending',
  "epoch"      INTEGER,
  "batchRoot"  VARCHAR(66),
  "leafIndex"  INTEGER,
  "siblings"   JSONB,
  "txHash"     VARCHAR(66),
  "anchoredAt" TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "AnchorRecord_userId_createdAt_idx" ON "AnchorRecord" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnchorRecord_status_idx" ON "AnchorRecord" ("status");
