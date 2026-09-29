import { RangeNode } from './merkle';

/**
 * Wire format of protocol "ivf-ring-v2" (docs/thesis-plan.md, section 4).
 * Mirrors backend/src/verifiable-search/merkle/proof.types.ts exactly —
 * field names and order matter because leaves are recomputed from these
 * raw values, never trusted from the server.
 */

/** One IVF cluster as committed in the global tree. */
export interface CentroidEntry {
  clusterId: number;
  centroid: number[];
  clusterRoot: string;
  /** Number of vectors in the cluster; committed so a range cannot be cut short at the end. */
  size: number;
}

/** A vector leaf at position `index` of its cluster (clusters are sorted by distance to the centroid). */
export interface RevealedLeaf {
  index: number;
  id: string;
  vector: number[];
  metadata: unknown;
}

/** Contiguous slice [lo, lo + leaves.length) of one probed cluster plus the nodes to close its tree. */
export interface RangeProof {
  clusterId: number;
  lo: number;
  leaves: RevealedLeaf[];
  nodes: RangeNode[];
}

export interface ProofBundle {
  protocol: 'ivf-ring-v2';
  indexVersion: number;
  globalRoot: string;
  k: number;
  nprobe: number;
  /** The server's embedding of the query; the client should pass its own via VerifyOptions. */
  queryVector: number[];
  /** Every cluster of the index, ordered by clusterId. */
  centroids: CentroidEntry[];
  /** One range per probed cluster. */
  ranges: RangeProof[];
  /** The answer: ids of the top-k results, nearest first. */
  resultIds: string[];
}

/** Anything that can read the anchor registry — a mock today, a viem reader of MerkleAnchor.sol later. */
export interface ChainReader {
  getRoot(version: number): Promise<{ root: string; timestamp: number } | null>;
  getLatestVersion(): Promise<number | null>;
}

export interface VerifyOptions {
  /** The client's own embedding of the query. Without it the server's queryVector is trusted. */
  queryVector?: number[];
}

export interface VerificationStep {
  id: 'protocol' | 'anchor' | 'freshness' | 'query' | 'centroids' | 'selection' | 'results' | 'completeness' | 'topk';
  label: string;
  ok: boolean;
  detail: string;
}

export interface VerificationResult {
  valid: boolean;
  /** Detail of the first failed step. */
  reason?: string;
  steps: VerificationStep[];
}
