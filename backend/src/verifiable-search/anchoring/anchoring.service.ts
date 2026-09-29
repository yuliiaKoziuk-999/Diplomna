import { Injectable } from '@nestjs/common';
import { hashLeaf } from '../merkle/merkle-tree';

export interface Anchor {
  version: number;
  root: string;
  timestamp: number;
  txHash: string;
}

/**
 * - `index`: versions of the verifiable-search index; clients require the latest.
 * - `documents`: Anchor API epochs (batches of document hashes).
 * Each stream corresponds to its own MerkleAnchor.sol deployment, so a
 * document epoch never counts as a newer index version.
 */
export type AnchorStream = 'index' | 'documents';

/**
 * MOCK anchoring service — stands in for contracts/MerkleAnchor.sol until
 * it is actually deployed to Polygon Amoy (task "Hardhat-проект + деплой
 * MerkleAnchor.sol" is still open). Same read/write shape as the contract
 * (anchorRoot/getRoot/latestVersion), so a later `PolygonAnchoringService`
 * built on viem is a drop-in replacement. In-memory: anchors vanish when
 * the process restarts.
 */
@Injectable()
export class AnchoringService {
  private readonly streams: Record<AnchorStream, { anchors: Map<number, Anchor>; latest: number }> = {
    index: { anchors: new Map(), latest: 0 },
    documents: { anchors: new Map(), latest: 0 },
  };

  anchorRoot(root: string, stream: AnchorStream = 'index'): Anchor {
    const s = this.streams[stream];
    s.latest += 1;
    const anchor: Anchor = {
      version: s.latest,
      root,
      timestamp: Date.now(),
      txHash: hashLeaf(`mock-tx:${stream}:${s.latest}:${root}:${Date.now()}`),
    };
    s.anchors.set(s.latest, anchor);
    return anchor;
  }

  getRoot(version: number, stream: AnchorStream = 'index'): Anchor | undefined {
    return this.streams[stream].anchors.get(version);
  }

  getLatest(stream: AnchorStream = 'index'): Anchor | undefined {
    const s = this.streams[stream];
    return s.anchors.get(s.latest);
  }
}
