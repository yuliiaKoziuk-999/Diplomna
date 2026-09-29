import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { IvfIndexService } from '../ivf/ivf-index.service';
import { Cluster, euclideanDistance } from '../ivf/cluster';
import { AnchoringService, Anchor } from '../anchoring/anchoring.service';
import { buildClusterTree, buildGlobalTree, ClusterTree } from '../merkle/cluster-tree.builder';
import { getRangeProof, MerkleBuildResult } from '../merkle/merkle-tree';
import { CentroidEntryDto, ProofBundle, RangeProofDto } from '../merkle/proof.types';
import { DEMO_CORPUS, DemoDocument, embedText } from './demo-corpus';
import { SimulatedAttack, VerifiableSearchDto } from './query.dto';

const NLIST = 6;
/**
 * Slack when choosing ring boundaries, so the boundary leaves the client
 * checks are strictly outside the ring even with float rounding differences.
 */
const RING_EPS = 1e-9;
/** Documents added after v1, so a rollback to v1 is observable in the demo. */
const ADDED_IN_V2 = 3;

interface IndexSnapshot {
  clusters: Cluster[];
  trees: ClusterTree[];
  global: MerkleBuildResult;
  anchor: Anchor;
}

export interface SearchResponse {
  results: { id: string; text: string; distance: number; clusterId: number }[];
  proofBundle: ProofBundle;
  anchor: Anchor;
  /** Set when the demo server was asked to misbehave; the client must detect it on its own. */
  simulatedAttack?: SimulatedAttack;
}

/**
 * Authenticated IVF search with ring range proofs (protocol ivf-ring-v2,
 * thesis-plan.md section 4): build IVF index -> Merkle-authenticate it ->
 * anchor the root (mocked, see AnchoringService) -> answer queries with a
 * proof bundle that lets a client check correctness, completeness relative
 * to nprobe, and freshness on its own (verification-sdk).
 */
@Injectable()
export class QueryService implements OnModuleInit {
  private current!: IndexSnapshot;
  /** The previous version, kept only so the demo can simulate a rollback attack. */
  private previous: IndexSnapshot | null = null;

  constructor(
    private readonly ivf: IvfIndexService,
    private readonly anchoring: AnchoringService,
  ) {}

  onModuleInit() {
    this.rebuildIndex(DEMO_CORPUS.slice(0, DEMO_CORPUS.length - ADDED_IN_V2));
    this.rebuildIndex(DEMO_CORPUS);
  }

  /** Builds and anchors a new index version; run on every corpus change in a real deployment. */
  rebuildIndex(corpus: DemoDocument[] = DEMO_CORPUS): Anchor {
    const clusters = this.ivf.build(
      corpus.map((doc) => ({ id: doc.id, vector: embedText(doc.text), metadata: { text: doc.text } })),
      NLIST,
    );
    const trees = clusters.map(buildClusterTree);
    const global = buildGlobalTree(trees, clusters);
    const anchor = this.anchoring.anchorRoot(global.root, 'index');
    this.previous = this.current ?? null;
    this.current = { clusters, trees, global, anchor };
    return anchor;
  }

  getAnchor(version: number): Anchor | undefined {
    return this.anchoring.getRoot(version, 'index');
  }

  getLatestAnchor(): Anchor | undefined {
    return this.anchoring.getLatest('index');
  }

  search(dto: VerifiableSearchDto): SearchResponse {
    const attack = dto.attack;
    if (attack && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Симуляція атак доступна лише в тестовому середовищі');
    }
    const snap = attack === 'rollback' && this.previous ? this.previous : this.current;
    const q = embedText(dto.query);
    const { k } = dto;
    const nprobe = Math.min(dto.nprobe, snap.clusters.length);

    const ranked = this.ivf.centroidDistances(q, snap.clusters);
    let probedIds = ranked.slice(0, nprobe).map((c) => c.clusterId);
    if (attack === 'centroid' && nprobe < ranked.length) {
      // Skip the nearest cluster, take the next one instead.
      probedIds = ranked.slice(1, nprobe + 1).map((c) => c.clusterId);
    }
    const probed = probedIds.map((id) => snap.clusters[id]);

    let top = this.ivf.searchClusters(q, k, probed);
    let hiddenId: string | null = null;
    if (attack === 'hide' && top.length) {
      hiddenId = top[0].id;
      top = this.ivf.searchClusters(q, k + 1, probed).filter((c) => c.id !== hiddenId).slice(0, k);
    }
    const rk = top.length === k ? top[k - 1].distance : Infinity;

    const ranges = probed.map((cluster) => this.ringRange(cluster, snap.trees[cluster.clusterId], q, rk, hiddenId));
    if (attack === 'tamper' && top.length) {
      const leaf = ranges.flatMap((r) => r.leaves).find((l) => l.id === top[0].id);
      if (leaf) leaf.vector = leaf.vector.map((x, i) => (i === 0 ? x + 0.05 : x));
    }

    const centroids: CentroidEntryDto[] = snap.clusters.map((c) => ({
      clusterId: c.clusterId,
      centroid: c.centroid,
      clusterRoot: snap.trees[c.clusterId].merkle.root,
      size: c.vectors.length,
    }));

    return {
      results: top.map((r) => ({
        id: r.id,
        text: String((r.metadata as { text?: string })?.text ?? ''),
        distance: r.distance,
        clusterId: r.clusterId,
      })),
      proofBundle: {
        protocol: 'ivf-ring-v2',
        indexVersion: snap.anchor.version,
        globalRoot: snap.global.root,
        k,
        nprobe,
        queryVector: q,
        centroids,
        ranges,
        resultIds: top.map((r) => r.id),
      },
      anchor: snap.anchor,
      simulatedAttack: attack,
    };
  }

  /**
   * The contiguous slice of the cluster (sorted by distance to the centroid)
   * whose distances fall in the ring [‖q−c‖ − r_k, ‖q−c‖ + r_k], widened by one
   * leaf on each side so the client can see where the ring ends.
   */
  private ringRange(cluster: Cluster, tree: ClusterTree, q: number[], rk: number, hiddenId: string | null): RangeProofDto {
    const n = cluster.vectors.length;
    if (n === 0) return { clusterId: cluster.clusterId, lo: 0, leaves: [], nodes: [] };
    const dqc = euclideanDistance(q, cluster.centroid);
    const r = cluster.vectors.map((v) => euclideanDistance(v.vector, cluster.centroid));
    let lo = 0;
    while (lo < n && r[lo] < dqc - rk - RING_EPS) lo++;
    let hi = n - 1;
    while (hi >= 0 && r[hi] > dqc + rk + RING_EPS) hi--;
    const from = Math.max(0, lo - 1);
    const to = Math.min(n - 1, hi + 1);

    const leaves = [];
    for (let i = from; i <= to; i++) {
      const v = cluster.vectors[i];
      if (v.id === hiddenId) continue; // simulated incompleteness attack
      leaves.push({ index: i, id: v.id, vector: [...v.vector], metadata: v.metadata ?? null });
    }
    return {
      clusterId: cluster.clusterId,
      lo: from,
      leaves,
      nodes: getRangeProof(tree.merkle.layers, from, to),
    };
  }
}
