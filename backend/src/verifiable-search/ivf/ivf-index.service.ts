import { Injectable } from '@nestjs/common';
import { kmeans } from 'ml-kmeans';
import { Cluster, IndexedVector, euclideanDistance, sortClusterVectors } from './cluster';

export interface IvfCandidate {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  distance: number;
  clusterId: number;
}

export interface CentroidDistance {
  clusterId: number;
  centroid: number[];
  distance: number;
}

/**
 * Own IVF implementation (not FAISS — see docs/tech-stack.md) so that each
 * inverted list stays a plain array in an order we control: sorted by
 * distance to its centroid, which the ring proof of completeness needs
 * (thesis-plan.md, section 4.2). A black-box ANN library would not expose
 * cluster contents in this shape.
 *
 * Stateless: QueryService keeps several index versions side by side.
 */
@Injectable()
export class IvfIndexService {
  build(vectors: IndexedVector[], nlist: number): Cluster[] {
    if (vectors.length === 0) return [];
    const effectiveNlist = Math.max(1, Math.min(nlist, vectors.length));
    const result = kmeans(
      vectors.map((v) => v.vector),
      effectiveNlist,
      { initialization: 'kmeans++', seed: 42 },
    );
    const byCluster = new Map<number, IndexedVector[]>();
    result.clusters.forEach((clusterId, i) => {
      const list = byCluster.get(clusterId) ?? [];
      list.push(vectors[i]);
      byCluster.set(clusterId, list);
    });
    return result.centroids.map((centroid, clusterId) => ({
      clusterId,
      centroid,
      vectors: sortClusterVectors(byCluster.get(clusterId) ?? [], centroid),
    }));
  }

  /** Distances to every centroid, nearest first (ties by clusterId, as the client sorts). */
  centroidDistances(query: number[], clusters: Cluster[]): CentroidDistance[] {
    return clusters
      .map((c) => ({ clusterId: c.clusterId, centroid: c.centroid, distance: euclideanDistance(query, c.centroid) }))
      .sort((a, b) => a.distance - b.distance || a.clusterId - b.clusterId);
  }

  /** Exhaustive search inside the given clusters, nearest first (ties by id, as the client sorts). */
  searchClusters(query: number[], k: number, clusters: Cluster[]): IvfCandidate[] {
    const candidates: IvfCandidate[] = [];
    for (const cluster of clusters) {
      for (const v of cluster.vectors) {
        candidates.push({
          id: v.id,
          vector: v.vector,
          metadata: v.metadata,
          distance: euclideanDistance(query, v.vector),
          clusterId: cluster.clusterId,
        });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return candidates.slice(0, k);
  }
}
