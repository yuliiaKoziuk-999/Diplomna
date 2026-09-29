export interface IndexedVector {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface Cluster {
  clusterId: number;
  centroid: number[];
  /**
   * Sorted by distance to the centroid (ties by id). The ring proof of
   * completeness relies on this order: every candidate for a query lies in
   * one contiguous slice of it (thesis-plan.md, section 4.2).
   */
  vectors: IndexedVector[];
}

export function sortClusterVectors(vectors: IndexedVector[], centroid: number[]): IndexedVector[] {
  return vectors
    .map((v) => ({ v, r: euclideanDistance(v.vector, centroid) }))
    .sort((a, b) => a.r - b.r || (a.v.id < b.v.id ? -1 : a.v.id > b.v.id ? 1 : 0))
    .map((x) => x.v);
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
