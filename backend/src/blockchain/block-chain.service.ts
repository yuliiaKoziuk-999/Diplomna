import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { mineBlock } from './mineBlock';
import { Block as BlockchainBlock } from './block'; // Цей клас повинен мати метод calculateHash()
import { Block } from './block.model';
import { Message } from 'src/chatroom/message.model';
import { User } from 'src/user/user.model';
import { Chatroom } from 'src/chatroom/chatroom.model';

@Injectable()
export class BlockChainService {
  private difficulty = 0;

  constructor(
    @InjectModel(Block) private readonly blockModel: typeof Block,
    @InjectModel(Message) private readonly messageModel: typeof Message,
  ) {}

  async getLastBlock() {
    return this.blockModel.findOne({
      order: [['index', 'DESC']],
    });
  }

  async getAll() {
    return this.blockModel.findAll({
      order: [['index', 'ASC']],
      include: [{ model: Message, as: 'message' }],
    });
  }

  async addBlock({
    chatroomId,
    userId,
    content,
    imageUrl,
  }: {
    chatroomId: number;
    userId: number;
    content: string;
    imageUrl: string;
  }) {
    const lastBlock = await this.getLastBlock();

    const index = lastBlock ? lastBlock.index + 1 : 0;
    const previousHash = lastBlock?.hash ?? '0';
    const timestamp = new Date();

    const blockData = {
      chatroomId: chatroomId,
      userId: userId,
      message: content,
      imagePath: imageUrl,
      timestamp: new Date().toISOString(),
    };
    const tempBlock = new BlockchainBlock(
      index,
      timestamp,
      blockData,
      previousHash,
    );
    mineBlock(tempBlock, this.difficulty);
    const createdMessage = await this.messageModel.create({
      chatroomId,
      userId,
      content,
      imageUrl,
      createdAt: new Date(),
      blockHash: tempBlock.hash,
    });

    if (!createdMessage) throw new Error('Message not found');

    await this.blockModel.create({
      index,
      timestamp,
      previousHash,
      hash: tempBlock.hash,
      messageId: createdMessage.id,
    });

    const message = await this.messageModel.findByPk(createdMessage.id, {
      include: [
        { model: User, as: 'user' },
        {
          model: Chatroom,
          as: 'chatroom',
          include: [{ model: User, as: 'users' }],
        },
      ],
    });

    return message;
  }

  async getBlockByHash(hash: string) {
    return this.blockModel.findOne({
      where: { hash },
      include: [{ model: Message, as: 'message' }],
    });
  }

  async validateBlockData(blockId: number): Promise<boolean> {
    const block = await this.blockModel.findByPk(blockId, {
      include: [{ model: Message, as: 'message' }],
    });

    if (!block || !block.message) {
      console.warn(
        `[Blockchain] ❌ Блок або повідомлення не знайдено. BlockID=${blockId}`,
      );
      return false;
    }

    const { chatroomId, userId, content, imageUrl, createdAt } = block.message;

    const data = {
      chatroomId,
      userId,
      message: content,
      imagePath: imageUrl,
      timestamp: createdAt.toISOString(),
    };

    const virtualBlock = new BlockchainBlock(
      block.index,
      block.timestamp,
      data,
      block.previousHash,
    );

    const expectedHash = virtualBlock.calculateHash();

    // ✅ Перевірка хешу блоку
    const isHashValid = block.hash === expectedHash;

    // ✅ Перевірка previousHash
    let isPreviousHashValid = true;

    if (block.index > 0) {
      const previousBlock = await this.blockModel.findOne({
        where: { index: block.index - 1 },
      });

      if (!previousBlock || previousBlock.hash !== block.previousHash) {
        isPreviousHashValid = false;
        console.error(
          `[Blockchain] ❌ previousHash не збігається у блоці #${block.index}`,
        );
        console.debug(`→ Очікуваний: ${previousBlock?.hash}`);
        console.debug(`→ Має бути:   ${block.previousHash}`);
      }
    }

    if (!isHashValid) {
      console.error(
        `[Blockchain] ❌ Хеш не збігається у блоці #${block.index}`,
      );
      console.debug(`→ Очікуваний: ${expectedHash}`);
      console.debug(`→ Фактичний:  ${block.hash}`);
    }

    return isHashValid && isPreviousHashValid;
  }

  async isChainValid(): Promise<boolean> {
    const chain = await this.getAll();
    for (let i = 1; i < chain.length; i++) {
      const current = chain[i];
      const previous = chain[i - 1];

      const data = {
        chatroomId: current.message.chatroomId,
        userId: current.message.userId,
        message: current.message.content,
        imagePath: current.message.imageUrl,
        timestamp: current.message.createdAt.toISOString(),
      };

      const virtualBlock = new BlockchainBlock(
        current.index,
        current.timestamp,
        data,
        current.previousHash,
      );
      if (current.hash !== virtualBlock.calculateHash()) return false;
      if (current.previousHash !== previous.hash) return false;
    }

    return true;
  }
}
