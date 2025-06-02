import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { BlockChainService } from './block-chain.service';
import { Block } from './block';
import { mineBlock } from './mineBlock';

@Injectable()
export class BlockChainServiceChat {
  chain: any;
  difficulty: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockChainService,
  ) {}

  async addMessage(data: {
    sender: string;
    message: string;
    messageId: number;
  }): Promise<Block> {
    const previousBlock = await this.blockchainService.getLastBlock();
    const newBlock = new Block(
      previousBlock.id + 1,
      new Date(),
      data,
      previousBlock.hash,
    );
    mineBlock(newBlock, this.difficulty);
    this.chain.push(newBlock);

    //  Зберігаємо в БД
    await this.prisma.block.create({
      data: {
        index: newBlock.index,
        timestamp: new Date(newBlock.timestamp),
        messageId: data.messageId,
        previousHash: newBlock.previousHash,
        hash: newBlock.hash,
      },
    });

    return newBlock;
  }

  async getAll() {
    const dbBlocks = await this.prisma.block.findMany({
      orderBy: { index: 'asc' },
    });
    return dbBlocks;
  }
}
