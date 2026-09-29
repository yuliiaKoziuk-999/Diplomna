import { RangeNode } from './merkle-tree';

/**
 * Wire format of protocol ivf-ring-v2. Carries the RAW committed values
 * (centroid, vector, metadata) rather than server-computed hashes — the
 * client recomputes every leaf itself. Keep field names and order
 * identical to verification-sdk/src/types.ts.
 */

export interface CentroidEntryDto {
  clusterId: number;
  centroid: number[];
  clusterRoot: string;
  size: number;
}

export interface RevealedLeafDto {
  index: number;
  id: string;
  vector: number[];
  metadata: unknown;
}

export interface RangeProofDto {
  clusterId: number;
  lo: number;
  leaves: RevealedLeafDto[];
  nodes: RangeNode[];
}

export interface ProofBundle {
  protocol: 'ivf-ring-v2';
  indexVersion: number;
  globalRoot: string;
  k: number;
  nprobe: number;
  queryVector: number[];
  centroids: CentroidEntryDto[];
  ranges: RangeProofDto[];
  resultIds: string[];
}
