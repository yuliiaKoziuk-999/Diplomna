/**
 * Docker-free Postgres for local demos and e2e runs: starts an embedded
 * PostgreSQL on the port and credentials from DATABASE_URL (5433,
 * johndoe/123, chatapp), creates the legacy chat schema on a fresh data
 * directory (the old Prisma migrations, read from git history), applies
 * backend/migrations, and keeps running until Ctrl+C.
 *
 * Usage: npm run demo:db     (data lives in backend/.demo-pg, git-ignored)
 */
import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(here, '..');
const repoDir = path.join(backendDir, '..');
const dataDir = path.join(backendDir, '.demo-pg');
const LEGACY_SQL_DIR = 'backend/prisma/migrations';

const db = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'johndoe',
  password: '123',
  port: 5433,
  persistent: true,
  // Without this initdb picks the Windows code page (e.g. WIN1250) and rejects Cyrillic text.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

async function main() {
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) await db.initialise();
  await db.start();
  try {
    await db.createDatabase('chatapp');
  } catch {
    // already exists
  }

  const client = new pg.Client({ connectionString: 'postgresql://johndoe:123@localhost:5433/chatapp' });
  await client.connect();
  const { rows } = await client.query(`SELECT to_regclass('"User"') AS t`);
  if (!rows[0].t) {
    const files = execSync(`git ls-tree -r --name-only HEAD ${LEGACY_SQL_DIR}`, { cwd: repoDir })
      .toString()
      .split('\n')
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      await client.query(execSync(`git show HEAD:${f}`, { cwd: repoDir }).toString());
    }
    console.log(`legacy schema: applied ${files.length} Prisma migrations from git`);
  }
  await client.end();

  execSync('node scripts/migrate.js', { cwd: backendDir, stdio: 'inherit' });
  console.log('demo Postgres ready on localhost:5433 (Ctrl+C to stop)');
}

const stop = async () => {
  await db.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

main().catch(async (err) => {
  console.error(err);
  await db.stop().catch(() => undefined);
  process.exit(1);
});
