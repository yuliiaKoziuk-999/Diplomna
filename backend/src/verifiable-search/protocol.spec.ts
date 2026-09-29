import { IvfIndexService } from './ivf/ivf-index.service';
import { AnchoringService } from './anchoring/anchoring.service';
import { QueryService } from './query/query.service';
import { SIMULATED_ATTACKS } from './query/query.dto';
import { buildMerkleTree, getRangeProof, hashLeaf } from './merkle/merkle-tree';
// The client SDK is the verifier under test: backend proofs must pass it, attacks must not.
import { embedDemoText, rootFromRange, verifySearchResult } from '../../../verification-sdk/src';

describe('range proofs (backend prover, SDK verifier)', () => {
  const leaves = (n: number) => Array.from({ length: n }, (_, i) => hashLeaf(`leaf-${i}`));

  it('rebuild the root for every contiguous range of trees with 1..17 leaves', () => {
    for (let n = 1; n <= 17; n++) {
      const tree = buildMerkleTree(leaves(n));
      for (let lo = 0; lo < n; lo++) {
        for (let hi = lo; hi < n; hi++) {
          const nodes = getRangeProof(tree.layers, lo, hi);
          expect(rootFromRange(tree.layers[0].slice(lo, hi + 1), lo, n, nodes)).toBe(tree.root);
        }
      }
    }
  });

  it('cannot close the tree when a leaf inside the range is dropped', () => {
    const n = 13;
    const tree = buildMerkleTree(leaves(n));
    const nodes = getRangeProof(tree.layers, 3, 9);
    const withGap = [...tree.layers[0].slice(3, 6), ...tree.layers[0].slice(7, 10)];
    expect(rootFromRange(withGap, 3, n, nodes)).not.toBe(tree.root);
  });

  it('treats an empty cluster as the empty-tree root', () => {
    expect(rootFromRange([], 0, 0, [])).toBe(buildMerkleTree([]).root);
  });
});

describe('ivf-ring-v2 end to end', () => {
  const anchoring = new AnchoringService();
  const service = new QueryService(new IvfIndexService(), anchoring);
  service.onModuleInit();
  const chain = {
    getRoot: async (v: number) => anchoring.getRoot(v, 'index') ?? null,
    getLatestVersion: async () => anchoring.getLatest('index')?.version ?? null,
  };

  const queries = [
    'блокчейн анкорування Polygon',
    'дерево Меркла доказ включення',
    'атака приховує результати пошуку',
    'векторна база даних embeddings',
  ];
  const params = [
    { k: 1, nprobe: 1 },
    { k: 3, nprobe: 2 },
    { k: 5, nprobe: 4 },
  ];

  it.each(queries)('accepts honest answers to "%s"', async (query) => {
    for (const p of params) {
      const { proofBundle } = service.search({ query, ...p });
      const verdict = await verifySearchResult(proofBundle, chain, { queryVector: embedDemoText(query) });
      expect(verdict).toMatchObject({ valid: true });
    }
  });

  it.each(SIMULATED_ATTACKS)('rejects the "%s" attack for every query', async (attack) => {
    for (const query of queries) {
      for (const p of params) {
        const { proofBundle } = service.search({ query, ...p, attack });
        const verdict = await verifySearchResult(proofBundle, chain, { queryVector: embedDemoText(query) });
        expect(verdict.valid).toBe(false);
      }
    }
  });

  it('rejects an answer computed for a different query', async () => {
    const { proofBundle } = service.search({ query: 'Polygon Amoy', k: 3, nprobe: 2 });
    const verdict = await verifySearchResult(proofBundle, chain, { queryVector: embedDemoText('Hardhat Solidity') });
    expect(verdict.reason).toMatch(/іншим вектором/);
  });

  it('does not let document epochs shift the index version', () => {
    anchoring.anchorRoot(hashLeaf('documents-batch'), 'documents');
    expect(anchoring.getLatest('index').version).toBe(2);
  });
});
