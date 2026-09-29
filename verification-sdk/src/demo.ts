/**
 * Standalone, dependency-free proof that protocol ivf-ring-v2 works — no
 * NestJS, no database, no real Polygon. Run with: npm run demo (inside
 * verification-sdk/). A tiny prover below builds an authenticated IVF
 * index, anchors it in an in-memory "chain" (twice, so a rollback exists),
 * answers one query honestly and then with each attack from
 * thesis-plan.md section 8. Only the honest answer must verify.
 *
 * The production prover is backend/src/verifiable-search/query/query.service.ts.
 */
import { buildMerkleTree, getRangeProof } from './merkle';
import { centroidLeafHash, euclideanDistance as dist, vectorLeafHash } from './leaves';
import { verifySearchResult } from './verify';
import { InMemoryChainReader } from './chain-readers';
import { ProofBundle, RangeProof } from './types';

type Doc = { id: string; vector: number[] };
const CENTROIDS = [[0, 0], [5, 5], [0, 5]];
const DOCS: Doc[] = Array.from({ length: 36 }, (_, i) => {
  const c = CENTROIDS[i % 3];
  const a = i * 2.399963; // golden angle: points spread around each centroid
  const r = 0.2 + (i % 12) * 0.12;
  return { id: `d${String(i).padStart(2, '0')}`, vector: [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] };
});

function buildIndex(docs: Doc[]) {
  const clusters = CENTROIDS.map((centroid, clusterId) => ({
    clusterId,
    centroid,
    vectors: docs
      .filter((d) => CENTROIDS.map((c) => dist(d.vector, c)).indexOf(Math.min(...CENTROIDS.map((c) => dist(d.vector, c)))) === clusterId)
      .sort((a, b) => dist(a.vector, centroid) - dist(b.vector, centroid) || (a.id < b.id ? -1 : 1)),
  }));
  const trees = clusters.map((c) =>
    buildMerkleTree(c.vectors.map((v, i) => vectorLeafHash(c.clusterId, { index: i, id: v.id, vector: v.vector, metadata: null }))),
  );
  const centroids = clusters.map((c) => ({ clusterId: c.clusterId, centroid: c.centroid, clusterRoot: trees[c.clusterId].root, size: c.vectors.length }));
  return { clusters, trees, centroids, root: buildMerkleTree(centroids.map(centroidLeafHash)).root };
}

const v1 = buildIndex(DOCS.slice(0, 30));
const v2 = buildIndex(DOCS);
const chain = new InMemoryChainReader(
  new Map([
    [1, { root: v1.root, timestamp: Date.now() }],
    [2, { root: v2.root, timestamp: Date.now() }],
  ]),
);

type Attack = 'hide' | 'centroid' | 'tamper' | 'rollback' | undefined;

function answer(q: number[], k: number, nprobe: number, attack: Attack): ProofBundle {
  const idx = attack === 'rollback' ? v1 : v2;
  const version = attack === 'rollback' ? 1 : 2;
  const ranked = idx.clusters.map((c) => ({ id: c.clusterId, d: dist(q, c.centroid) })).sort((a, b) => a.d - b.d || a.id - b.id);
  const probedIds = (attack === 'centroid' ? ranked.slice(1, nprobe + 1) : ranked.slice(0, nprobe)).map((c) => c.id);
  const candidates = probedIds
    .flatMap((id) => idx.clusters[id].vectors)
    .map((v) => ({ id: v.id, d: dist(q, v.vector) }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1));
  const hidden = attack === 'hide' ? candidates[0].id : null;
  const top = candidates.filter((c) => c.id !== hidden).slice(0, k);
  const rk = top.length === k ? top[k - 1].d : Infinity;

  const ranges: RangeProof[] = probedIds.map((id) => {
    const c = idx.clusters[id];
    const r = c.vectors.map((v) => dist(v.vector, c.centroid));
    const dqc = dist(q, c.centroid);
    let lo = 0;
    while (lo < r.length && r[lo] < dqc - rk - 1e-9) lo++;
    let hi = r.length - 1;
    while (hi >= 0 && r[hi] > dqc + rk + 1e-9) hi--;
    const from = Math.max(0, lo - 1);
    const to = Math.min(r.length - 1, hi + 1);
    const leaves = c.vectors
      .slice(from, to + 1)
      .map((v, j) => ({ index: from + j, id: v.id, vector: [...v.vector], metadata: null }))
      .filter((l) => l.id !== hidden);
    return { clusterId: id, lo: from, leaves, nodes: getRangeProof(idx.trees[id].layers, from, to) };
  });
  if (attack === 'tamper') {
    const leaf = ranges.flatMap((r) => r.leaves).find((l) => l.id === top[0].id)!;
    leaf.vector[0] += 0.05;
  }
  return {
    protocol: 'ivf-ring-v2',
    indexVersion: version,
    globalRoot: idx.root,
    k,
    nprobe,
    queryVector: q,
    centroids: idx.centroids,
    ranges,
    resultIds: top.map((t) => t.id),
  };
}

async function main() {
  console.log('--- ivf-ring-v2: перевірка повноти без БД і блокчейну ---\n');
  const q = [0.4, 0.3];
  const scenarios: [string, Attack][] = [
    ['Чесна відповідь', undefined],
    ['Приховати найкращий результат', 'hide'],
    ['Підмінити кластери', 'centroid'],
    ['Підробити вектор', 'tamper'],
    ['Rollback на стару версію', 'rollback'],
  ];
  for (const [name, attack] of scenarios) {
    const bundle = answer(q, 4, 2, attack);
    const verdict = await verifySearchResult(bundle, chain, { queryVector: q });
    const revealed = bundle.ranges.reduce((s, r) => s + r.leaves.length, 0);
    const total = bundle.ranges.reduce((s, r) => s + bundle.centroids[r.clusterId].size, 0);
    console.log(
      `${name.padEnd(32)} ${verdict.valid ? `VALID ✓  (розкрито ${revealed} з ${total} векторів)` : `REJECT ✗ (${verdict.reason})`}`,
    );
  }
}

main();
