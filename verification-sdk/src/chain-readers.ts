import { ChainReader } from './types';

/** For the standalone demo/tests — no network, no chain. */
export class InMemoryChainReader implements ChainReader {
  constructor(private anchors: Map<number, { root: string; timestamp: number }>) {}

  async getRoot(version: number) {
    return this.anchors.get(version) ?? null;
  }

  async getLatestVersion() {
    return this.anchors.size ? Math.max(...this.anchors.keys()) : null;
  }
}

/**
 * Reads the index anchors through verifiable-search's own REST API
 * (GET /verifiable-search/root/:version and /latest), which today is
 * backed by the MOCK AnchoringService (backend/src/verifiable-search/
 * anchoring). Once contracts/MerkleAnchor.sol is deployed to Polygon Amoy,
 * replace this with a viem `readContract` reader — verifySearchResult()
 * itself does not change, only where the root comes from.
 */
export class BackendMockChainReader implements ChainReader {
  constructor(private baseUrl: string) {}

  async getRoot(version: number) {
    const res = await fetch(`${this.baseUrl}/verifiable-search/root/${version}`);
    if (!res.ok) return null;
    const anchor = await res.json();
    return { root: anchor.root, timestamp: anchor.timestamp };
  }

  async getLatestVersion() {
    const res = await fetch(`${this.baseUrl}/verifiable-search/latest`);
    if (!res.ok) return null;
    const anchor = await res.json();
    return typeof anchor.version === 'number' ? anchor.version : null;
  }
}
