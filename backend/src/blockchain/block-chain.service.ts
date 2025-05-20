import { Block } from './block';
import { mineBlock } from './mineBlock';
import { Injectable } from '@nestjs/common';

@Injectable()
export class BlockChainService {
  private difficulty: number;
  private readonly chain: Block[] = [];
  constructor() {
    const genesisBlock: Block = new Block(0, new Date(), 'Genesis block');
    this.chain.push(genesisBlock);
    this.difficulty = 0;
  }
  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }
  getAll(): Block[] {
    return this.chain;
  }

  addBlock(data): Block {
    const { index, hash } = this.getLastBlock();
    const newBlock = new Block(index + 1, new Date(), data, hash);
    mineBlock(newBlock, this.difficulty);
    this.chain.push(newBlock);
    return newBlock;
  }

  getBlockByHash(hash: string): Block | undefined {
    return this.chain.find((block) => block.hash === hash);
  }

  validateBlockData(block: Block, message: any): boolean {
    // Перевіряємо відповідність даних блоку і повідомлення з БД
    if (!block || !message) return false;

    const data = block.data;
    return (
      data.chatroomId === message.chatroomId &&
      data.userId === message.userId &&
      data.message === message.content &&
      data.imagePath === message.imageUrl &&
      data.timestamp === message.createdAt.toISOString()
    );
  }
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      if (currentBlock.hash != currentBlock.calculateHash()) {
        return false;
      }
      if (previousBlock.hash != currentBlock.previousHash) {
        return false;
      }
    }
    return true;
  }
}
