import { buildMerkleTree, rootFromRange } from './merkle';
import { centroidLeafHash, euclideanDistance, vectorLeafHash } from './leaves';
import {
  ChainReader,
  ProofBundle,
  RevealedLeaf,
  VerificationResult,
  VerificationStep,
  VerifyOptions,
} from './types';

const sameVector = (a: number[], b: number[]) =>
  a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

/**
 * Independent client-side verification of an ivf-ring-v2 proof bundle
 * (docs/thesis-plan.md, section 4). Trusts nothing the server computed:
 * every hash, distance and ranking is recomputed here, and the only
 * external truth is the anchor registry read through `chain`.
 *
 * Completeness is relative to the declared nprobe: nothing closer than the
 * k-th result was left out of the probed clusters. Ring lemma: for a
 * centroid c, |‖q−c‖ − ‖v−c‖| ≤ ‖q−v‖, so every v with ‖q−v‖ ≤ r_k has
 * ‖v−c‖ in [‖q−c‖ − r_k, ‖q−c‖ + r_k]. Clusters are committed sorted by
 * ‖v−c‖, hence those v form one contiguous range, and the two boundary
 * leaves outside the ring prove the range was not cut short.
 */
export async function verifySearchResult(
  bundle: ProofBundle,
  chain: ChainReader,
  options: VerifyOptions = {},
): Promise<VerificationResult> {
  const steps: VerificationStep[] = [];
  const pass = (id: VerificationStep['id'], label: string, detail: string) =>
    steps.push({ id, label, ok: true, detail });
  const fail = (id: VerificationStep['id'], label: string, detail: string): VerificationResult => {
    steps.push({ id, label, ok: false, detail });
    return { valid: false, reason: detail, steps };
  };

  if (bundle?.protocol !== 'ivf-ring-v2') {
    return fail('protocol', 'Формат доказу', `очікується протокол ivf-ring-v2, отримано ${bundle?.protocol ?? 'невідомий'}`);
  }

  // 1. The root is the one anchored for this version (tampered or foreign roots).
  const LABEL_ANCHOR = 'Корінь збігається з анкором';
  const anchor = await chain.getRoot(bundle.indexVersion);
  if (!anchor) return fail('anchor', LABEL_ANCHOR, `немає анкора для версії ${bundle.indexVersion}`);
  if (anchor.root.toLowerCase() !== bundle.globalRoot.toLowerCase()) {
    return fail('anchor', LABEL_ANCHOR, 'globalRoot не збігається з коренем у реєстрі');
  }
  pass('anchor', LABEL_ANCHOR, `версія ${bundle.indexVersion}`);

  // 2. ...and that version is the newest one (rollback to an old index).
  const LABEL_FRESH = 'Індекс найсвіжіший';
  const latest = await chain.getLatestVersion();
  if (latest === null) return fail('freshness', LABEL_FRESH, 'не вдалося прочитати latestVersion');
  if (bundle.indexVersion !== latest) {
    return fail('freshness', LABEL_FRESH, `версія ${bundle.indexVersion} застаріла, найновіша ${latest}`);
  }
  pass('freshness', LABEL_FRESH, `версія ${latest} = latestVersion`);

  // 3. The server searched for what the client asked.
  const LABEL_QUERY = 'Запит той самий';
  if (options.queryVector && !sameVector(options.queryVector, bundle.queryVector)) {
    return fail('query', LABEL_QUERY, 'сервер шукав за іншим вектором запиту');
  }
  const q = options.queryVector ?? bundle.queryVector;
  pass('query', LABEL_QUERY, options.queryVector ? 'вектор запиту обчислено клієнтом' : 'вектор запиту взято з відповіді сервера');

  // 4. All clusters, with their sizes, are exactly what the root commits to.
  const LABEL_CENT = 'Усі центроїди автентифіковані';
  const idsInOrder = bundle.centroids.every((c, i) => c.clusterId === i);
  if (!idsInOrder || buildMerkleTree(bundle.centroids.map(centroidLeafHash)).root !== bundle.globalRoot) {
    return fail('centroids', LABEL_CENT, 'globalRoot не відтворюється з розкритих центроїдів');
  }
  const byCluster = new Map(bundle.centroids.map((c) => [c.clusterId, c]));
  pass('centroids', LABEL_CENT, `globalRoot перераховано з ${bundle.centroids.length} листків`);

  // 5. The probed clusters are the truly nearest ones (fake centroid selection).
  const LABEL_SEL = 'Кластери обрано чесно';
  const expected = bundle.centroids
    .map((c) => ({ id: c.clusterId, d: euclideanDistance(q, c.centroid) }))
    .sort((a, b) => a.d - b.d || a.id - b.id)
    .slice(0, bundle.nprobe)
    .map((c) => c.id);
  const probed = bundle.ranges.map((r) => r.clusterId);
  if (probed.length !== expected.length || new Set(probed).size !== probed.length || !expected.every((id) => probed.includes(id))) {
    return fail('selection', LABEL_SEL, `мають бути кластери {${expected.join(', ')}}, сервер узяв {${probed.join(', ')}}`);
  }
  pass('selection', LABEL_SEL, `власні відстані: {${expected.join(', ')}}`);

  // 6. Every result is a revealed, authenticated leaf; r_k comes from them.
  const LABEL_RES = 'Результати є в індексі';
  const revealed = new Map<string, RevealedLeaf>();
  for (const range of bundle.ranges) for (const leaf of range.leaves) revealed.set(leaf.id, leaf);
  const missing = bundle.resultIds.find((id) => !revealed.has(id));
  if (missing) return fail('results', LABEL_RES, `результат ${missing} не входить у розкриті діапазони`);
  if (bundle.resultIds.length > bundle.k) return fail('results', LABEL_RES, 'повернуто більше за k результатів');
  const rk = bundle.resultIds.length >= bundle.k
    ? Math.max(...bundle.resultIds.map((id) => euclideanDistance(q, revealed.get(id)!.vector)))
    : Infinity;
  pass('results', LABEL_RES, `${bundle.resultIds.length} результатів, r_k = ${Number.isFinite(rk) ? rk.toFixed(4) : '∞'}`);

  // 7. Ring range proof per probed cluster (incompleteness, tampering).
  const LABEL_COMP = 'Нічого не приховано';
  for (const range of bundle.ranges) {
    const c = byCluster.get(range.clusterId)!;
    const n = range.leaves.length;
    if (!range.leaves.every((leaf, j) => leaf.index === range.lo + j)) {
      return fail('completeness', LABEL_COMP, `кластер ${c.clusterId}: діапазон не суцільний`);
    }
    if (c.size > 0 && n === 0) return fail('completeness', LABEL_COMP, `кластер ${c.clusterId}: порожній діапазон`);
    const hashes = range.leaves.map((leaf) => vectorLeafHash(c.clusterId, leaf));
    const root = rootFromRange(hashes, range.lo, c.size, range.nodes);
    if (root === null || root.toLowerCase() !== c.clusterRoot.toLowerCase()) {
      return fail('completeness', LABEL_COMP, `кластер ${c.clusterId}: корінь діапазону не збігається з закоміченим`);
    }
    if (n > 0) {
      const dqc = euclideanDistance(q, c.centroid);
      const first = range.leaves[0];
      const last = range.leaves[n - 1];
      if (!(range.lo === 0 || euclideanDistance(first.vector, c.centroid) < dqc - rk)) {
        return fail('completeness', LABEL_COMP, `кластер ${c.clusterId}: ліва межа всередині кільця, діапазон обрізано`);
      }
      if (!(range.lo + n === c.size || euclideanDistance(last.vector, c.centroid) > dqc + rk)) {
        return fail('completeness', LABEL_COMP, `кластер ${c.clusterId}: права межа всередині кільця, діапазон обрізано`);
      }
    }
  }
  const total = bundle.ranges.reduce((s, r) => s + r.leaves.length, 0);
  const clusterTotal = bundle.ranges.reduce((s, r) => s + byCluster.get(r.clusterId)!.size, 0);
  pass('completeness', LABEL_COMP, `розкрито ${total} з ${clusterTotal} векторів, межі кілець перевірено`);

  // 8. The answer is the true top-k of everything that could qualify.
  const LABEL_TOPK = 'Top-k перераховано клієнтом';
  const recomputed = [...revealed.values()]
    .map((leaf) => ({ id: leaf.id, d: euclideanDistance(q, leaf.vector) }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, bundle.k)
    .map((x) => x.id);
  const same = recomputed.length === bundle.resultIds.length && recomputed.every((id, i) => id === bundle.resultIds[i]);
  if (!same) return fail('topk', LABEL_TOPK, `справжній top-k: ${recomputed.join(', ')}`);
  pass('topk', LABEL_TOPK, 'збігається з відповіддю сервера');

  return { valid: true, steps };
}
