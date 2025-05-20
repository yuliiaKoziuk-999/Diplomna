import { Block } from './block';

export function mineBlock(block: Block, difficulty: number): void {
  const target = Array(difficulty + 1).join('0');
  while (!block.hash.startsWith(target)) {
    block.nonce++;
    block.hash = block.calculateHash();
  }
}
