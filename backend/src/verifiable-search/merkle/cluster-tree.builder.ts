import { Cluster } from '../ivf/cluster';
import { buildMerkleTree, hashLeaf, MerkleBuildResult } from './merkle-tree';

export interface ClusterTree {
  clusterId: number;
  merkle: MerkleBuildResult;
  leafIndexById: Map<string, number>;
}

/**
 * Leaf encodings of protocol ivf-ring-v2. Identical code lives in
 * verification-sdk/src/leaves.ts: change both or neither.
 *
 * The leaf includes its position, so a range with a dropped or moved leaf
 * cannot rebuild the cluster root.
 */
export function vectorLeafHash(
  clusterId: number,
  index: number,
  v: { id: string; vector: number[]; metadata?: unknown },
): string {
  return hashLeaf(
    JSON.stringify({
      clusterId,
      index,
      id: v.id,
      vector: v.vector,
      metadata: v.metadata ?? null,
    }),
  );
}

export function centroidLeafHash(c: {
  clusterId: number;
  centroid: number[];
  clusterRoot: string;
  size: number;
}): string {
  return hashLeaf(
    JSON.stringify({
      clusterId: c.clusterId,
      centroid: c.centroid,
      clusterRoot: c.clusterRoot,
      size: c.size,
    }),
  );
}

export function buildClusterTree(cluster: Cluster): ClusterTree {
  const leafHashes = cluster.vectors.map((v, i) => vectorLeafHash(cluster.clusterId, i, v));
  const merkle = buildMerkleTree(leafHashes);
  const leafIndexById = new Map(cluster.vectors.map((v, i) => [v.id, i]));
  return { clusterId: cluster.clusterId, merkle, leafIndexById };
}

/**
 * globalRoot's leaves commit to (clusterId, centroid, clusterRoot, size)
 * per cluster — one tree binding "which centroid" (for the client's own
 * nprobe selection) with "what's inside it" and "how many", so a range
 * cannot be cut short at the end of a cluster.
 */
export function buildGlobalTree(clusterTrees: ClusterTree[], clusters: Cluster[]): MerkleBuildResult {
  return buildMerkleTree(
    clusterTrees.map((ct, i) =>
      centroidLeafHash({
        clusterId: ct.clusterId,
        centroid: clusters[i].centroid,
        clusterRoot: ct.merkle.root,
        size: clusters[i].vectors.length,
      }),
    ),
  );
}
