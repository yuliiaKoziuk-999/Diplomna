/**
 * Minimal SQL migration runner: applies backend/migrations/*.sql in name
 * order, once each, recording them in "_Migration". Usage: npm run migrate
 */
require('dotenv').config({ path: ['.env.local', '.env'] });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(
    'CREATE TABLE IF NOT EXISTS "_Migration" ("name" VARCHAR(255) PRIMARY KEY, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  );
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await client.query('SELECT "name" FROM "_Migration"');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO "_Migration" ("name") VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`failed ${file}: ${err.message}`);
      process.exitCode = 1;
      break;
    }
  }
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
