import { hashLeaf } from './merkle';
import { CentroidEntry, RevealedLeaf } from './types';

/**
 * Leaf encodings of protocol ivf-ring-v2. Identical code lives in
 * backend/src/verifiable-search/merkle/cluster-tree.builder.ts: change
 * both or neither.
 */

/** The position is part of the leaf, so a leaf cannot be moved or dropped from a range unnoticed. */
export function vectorLeafHash(clusterId: number, leaf: RevealedLeaf): string {
  return hashLeaf(
    JSON.stringify({
      clusterId,
      index: leaf.index,
      id: leaf.id,
      vector: leaf.vector,
      metadata: leaf.metadata ?? null,
    }),
  );
}

export function centroidLeafHash(c: CentroidEntry): string {
  return hashLeaf(
    JSON.stringify({
      clusterId: c.clusterId,
      centroid: c.centroid,
      clusterRoot: c.clusterRoot,
      size: c.size,
    }),
  );
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
