import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BlockChainService } from './block-chain.service';
import { Block } from './block';
import { Block as BlockModel } from './block.model';
import { mineBlock } from './mineBlock';

@Injectable()
export class BlockChainServiceChat {
  chain: any;
  difficulty: number;
  constructor(
    @InjectModel(BlockModel) private readonly blockModel: typeof BlockModel,
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
    await this.blockModel.create({
      index: newBlock.index,
      timestamp: new Date(newBlock.timestamp),
      messageId: data.messageId,
      previousHash: newBlock.previousHash,
      hash: newBlock.hash,
    });

    return newBlock;
  }

  async getAll() {
    const dbBlocks = await this.blockModel.findAll({
      order: [['index', 'ASC']],
    });
    return dbBlocks;
  }
}
