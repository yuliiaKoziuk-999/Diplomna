/**
 * Runs the actual production module (IvfIndexService, AnchoringService,
 * QueryService) directly, without NestJS bootstrap or a database, and
 * checks every answer with the real client SDK — honest server first, then
 * each simulated attack, which must be rejected. Run from backend/:
 *   npx ts-node src/verifiable-search/scripts/smoke-test.ts
 */
import { IvfIndexService } from '../ivf/ivf-index.service';
import { AnchoringService } from '../anchoring/anchoring.service';
import { QueryService } from '../query/query.service';
import { SIMULATED_ATTACKS } from '../query/query.dto';
import { embedDemoText, verifySearchResult } from '../../../../verification-sdk/src';

async function main() {
  const anchoring = new AnchoringService();
  const service = new QueryService(new IvfIndexService(), anchoring);
  service.onModuleInit();

  const chain = {
    getRoot: async (v: number) => anchoring.getRoot(v, 'index') ?? null,
    getLatestVersion: async () => anchoring.getLatest('index')?.version ?? null,
  };

  const queries = [
    { query: 'блокчейн анкорування Polygon', k: 3, nprobe: 2 },
    { query: 'дерево Меркла доказ включення', k: 5, nprobe: 3 },
  ];
  let failures = 0;

  for (const dto of queries) {
    console.log(`\nЗапит: "${dto.query}" (k=${dto.k}, nprobe=${dto.nprobe})`);
    for (const attack of [undefined, ...SIMULATED_ATTACKS]) {
      const response = service.search({ ...dto, attack });
      const verdict = await verifySearchResult(response.proofBundle, chain, {
        queryVector: embedDemoText(dto.query),
      });
      const expectedValid = attack === undefined;
      if (verdict.valid !== expectedValid) failures++;
      const b = response.proofBundle;
      const revealed = b.ranges.reduce((s, r) => s + r.leaves.length, 0);
      const total = b.ranges.reduce((s, r) => s + b.centroids[r.clusterId].size, 0);
      console.log(
        `  ${(attack ?? 'чесний').padEnd(9)} ${verdict.valid ? 'VALID  ✓' : 'REJECT ✗'}` +
          `${verdict.valid === expectedValid ? '' : '  <-- НЕОЧІКУВАНО'}` +
          (attack === undefined ? `  (розкрито ${revealed} з ${total} векторів)` : `  ${verdict.reason}`),
      );
    }
  }

  if (failures) {
    console.error(`\n${failures} неочікуваних результатів`);
    process.exit(1);
  }
  console.log('\nУсі атаки виявлено, чесні відповіді прийнято.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
