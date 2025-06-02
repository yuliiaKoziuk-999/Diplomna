import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { mineBlock } from './mineBlock';
import { Block } from './block'; // Цей клас повинен мати метод calculateHash()
import { json } from 'stream/consumers';

@Injectable()
export class BlockChainService {
  private difficulty = 0;

  constructor(private readonly prisma: PrismaService) {}

  async getLastBlock() {
    return this.prisma.block.findFirst({
      orderBy: { index: 'desc' },
    });
  }

  async getAll() {
    return this.prisma.block.findMany({
      orderBy: { index: 'asc' },
      include: { message: true },
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
    const tempBlock = new Block(index, timestamp, blockData, previousHash);
    mineBlock(tempBlock, this.difficulty);
    const message = await this.prisma.message.create({
      data: {
        chatroomId,
        userId,
        content,
        imageUrl,
        createdAt: new Date(),
        blockHash: tempBlock.hash,
      },
      include: { user: true, chatroom: { include: { users: true } } },
    });

    if (!message) throw new Error('Message not found');

    const newBlock = await this.prisma.block.create({
      data: {
        index,
        timestamp,
        previousHash,
        hash: tempBlock.hash,
        messageId: message.id,
      },
    });

    return message;
  }

  async getBlockByHash(hash: string) {
    return this.prisma.block.findFirst({
      where: { hash },
      include: { message: true },
    });
  }

  async validateBlockData(blockId: number): Promise<boolean> {
    const block = await this.prisma.block.findUnique({
      where: { id: blockId },
      include: { message: true },
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

    const virtualBlock = new Block(
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
      const previousBlock = await this.prisma.block.findFirst({
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

      const virtualBlock = new Block(
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
