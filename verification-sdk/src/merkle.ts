import { keccak256 } from 'js-sha3';

/**
 * MUST stay byte-for-byte identical to
 * backend/src/verifiable-search/merkle/merkle-tree.ts (hashLeaf/hashPair/
 * buildMerkleTree/getRangeProof) — that is the one real risk of
 * duplicating this instead of sharing a package via an npm/turborepo
 * workspace (tracked as follow-up work).
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

export function hashPair(left: string, right: string): string {
  const a = hexToBytes(left);
  const b = hexToBytes(right);
  const [first, second] = compareBytes(a, b) <= 0 ? [a, b] : [b, a];
  return '0x' + keccak256(new Uint8Array([...first, ...second]));
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

export interface MerkleBuildResult {
  root: string;
  layers: string[][]; // layers[0] = leaves, last layer = [root]
}

/** Odd node at the end of a layer is carried up unchanged. Empty tree: hashLeaf(''). */
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
      next.push(i + 1 < current.length ? hashPair(current[i], current[i + 1]) : current[i]);
    }
    current = next;
    layers.push(current);
  }
  return { root: current[0], layers };
}

/** A tree node the verifier cannot compute from the revealed leaves. */
export interface RangeNode {
  level: number;
  index: number;
  hash: string;
}

/**
 * Multi-proof for the contiguous leaf range [lo, hi]: every sibling node
 * that the range's own leaves do not already determine, level by level.
 * O(log n) nodes for a range of any length.
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

/**
 * Recomputes the root from leaves placed at positions lo, lo+1, … of a tree
 * with `size` leaves. Returns null when the nodes cannot close the tree, so a
 * dropped or reordered leaf can never produce a matching root.
 */
export function rootFromRange(
  leafHashes: string[],
  lo: number,
  size: number,
  nodes: RangeNode[],
): string | null {
  if (size === 0) return leafHashes.length === 0 ? hashLeaf('') : null;
  if (leafHashes.length === 0 || lo < 0 || lo + leafHashes.length > size) return null;
  const extra = new Map(nodes.map((n) => [`${n.level}:${n.index}`, n.hash]));
  let current = new Map<number, string>();
  leafHashes.forEach((h, j) => current.set(lo + j, h));
  let level = 0;
  let width = size;
  while (width > 1) {
    const next = new Map<number, string>();
    for (const [i, h] of current) {
      const parent = i >> 1;
      if (next.has(parent)) continue;
      if (i === width - 1 && width % 2 === 1) {
        next.set(parent, h);
        continue;
      }
      const sibling = current.get(i ^ 1) ?? extra.get(`${level}:${i ^ 1}`);
      if (sibling === undefined) return null;
      next.set(parent, hashPair(h, sibling));
    }
    current = next;
    width = Math.ceil(width / 2);
    level++;
  }
  return current.get(0) ?? null;
}
