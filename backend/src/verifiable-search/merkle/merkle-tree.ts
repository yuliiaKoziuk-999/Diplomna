import { keccak256 } from 'js-sha3';

/**
 * Generic Merkle tree, hand-rolled on purpose (not `merkletreejs`) — see
 * docs/tech-stack.md. Keccak256 is used throughout so a real deployed
 * MerkleAnchor.sol (contracts/MerkleAnchor.sol) can verify the same roots
 * with Solidity's built-in `keccak256`.
 *
 * NOTE for anyone porting this to the browser (verification-sdk): keep
 * `hashLeaf`/`hashPair` byte-for-byte identical there, or proofs built
 * here will fail to verify on the client.
 */

export function hashLeaf(data: string): string {
  return '0x' + keccak256(data);
}

function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/^0x/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }
  return bytes;
}

function compareBytes(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/** Sorted-pair hashing (same convention as OpenZeppelin's MerkleProof) so
 * a proof needs no left/right direction bits — only the sibling hashes. */
export function hashPair(left: string, right: string): string {
  const a = hexToBytes(left);
  const b = hexToBytes(right);
  const [first, second] = compareBytes(a, b) <= 0 ? [a, b] : [b, a];
  return '0x' + keccak256(new Uint8Array([...first, ...second]));
}

export interface MerkleBuildResult {
  root: string;
  layers: string[][]; // layers[0] = leaves, last layer = [root]
}

export function buildMerkleTree(leafHashes: string[]): MerkleBuildResult {
  if (leafHashes.length === 0) {
    const emptyRoot = hashLeaf('');
    return { root: emptyRoot, layers: [[emptyRoot]] };
  }
  let current = [...leafHashes];
  const layers: string[][] = [current];
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(hashPair(current[i], current[i + 1]));
      } else {
        next.push(current[i]); // odd node carried up unchanged
      }
    }
    current = next;
    layers.push(current);
  }
  return { root: current[0], layers };
}

export function getInclusionProof(
  layers: string[][],
  leafIndex: number,
): { siblings: string[]; index: number } {
  const siblings: string[] = [];
  let idx = leafIndex;
  for (let level = 0; level < layers.length - 1; level++) {
    const layer = layers[level];
    const isRight = idx % 2 === 1;
    const siblingIndex = isRight ? idx - 1 : idx + 1;
    if (siblingIndex < layer.length) {
      siblings.push(layer[siblingIndex]);
    }
    idx = Math.floor(idx / 2);
  }
  return { siblings, index: leafIndex };
}

/** A tree node the verifier cannot compute from the revealed leaves. */
export interface RangeNode {
  level: number;
  index: number;
  hash: string;
}

/**
 * Multi-proof for the contiguous leaf range [lo, hi] (ring proof of
 * completeness, thesis-plan.md section 4.2): every sibling the range's own
 * leaves do not determine, level by level. O(log n) nodes per range.
 * Mirrors getRangeProof/rootFromRange in verification-sdk/src/merkle.ts.
 */
export function getRangeProof(layers: string[][], lo: number, hi: number): RangeNode[] {
  const nodes: RangeNode[] = [];
  let known = new Set<number>();
  for (let i = lo; i <= hi; i++) known.add(i);
  for (let level = 0; level < layers.length - 1; level++) {
    const width = layers[level].length;
    const next = new Set<number>();
    for (const i of [...known].sort((a, b) => a - b)) {
      const carried = i === width - 1 && width % 2 === 1;
      const sibling = i ^ 1;
      if (!carried && !known.has(sibling)) {
        nodes.push({ level, index: sibling, hash: layers[level][sibling] });
      }
      next.add(i >> 1);
    }
    known = next;
  }
  return nodes;
}

export function verifyInclusionProof(
  leafHash: string,
  siblings: string[],
  root: string,
): boolean {
  let computed = leafHash;
  for (const sibling of siblings) {
    computed = hashPair(computed, sibling);
  }
  return computed.toLowerCase() === root.toLowerCase();
}
