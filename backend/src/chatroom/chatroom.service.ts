import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Message, Prisma } from '@prisma/client';
import { createWriteStream } from 'fs';
import { BadRequestError } from 'openai';
import { AiService } from 'src/ai/ai.service';
import { AnomalyService } from 'src/anomaly/anomaly.service';
import { BlockChainService } from 'src/blockchain/block-chain.service';
import { PrismaService } from 'src/prisma.service';
import { json } from 'stream/consumers';

@Injectable()
export class ChatroomService {
  private aiUserId = 100001;
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly blockchainService: BlockChainService,
    private readonly aiService: AiService,
    private readonly anomalyService: AnomalyService,
  ) {}

  async getChatroom(id: string) {
    return this.prisma.chatroom.findUnique({
      where: {
        id: parseInt(id),
      },
    });
  }

  async createChatroom(name: string, sub: number) {
    const existingChatroom = await this.prisma.chatroom.findFirst({
      where: { name },
    });
    if (existingChatroom) {
      throw new BadRequestException({ name: 'Chatroom already exists' });
    }
    const chat = await this.prisma.chatroom.create({
      data: {
        name,
        users: {
          connect: [
            {
              id: sub,
            },
            {
              id: this.aiUserId,
            },
          ],
        },
      },
    });

    return chat;
  }

  async addUsersToChatroom(chatroomId: number, userIds: number[]) {
    const existingChatroom = await this.prisma.chatroom.findUnique({
      where: { id: chatroomId },
    });
    if (!existingChatroom) {
      throw new BadRequestException({ chatroomId: 'Chatroom does not exist' });
    }

    return await this.prisma.chatroom.update({
      where: { id: chatroomId },
      data: {
        users: {
          connect: userIds.map((id) => ({ id })),
        },
      },
      include: {
        users: true,
      },
    });
  }

  async getChatroomsForUser(userId: number) {
    return this.prisma.chatroom.findMany({
      where: {
        users: {
          some: { id: userId },
        },
      },
      include: {
        users: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  // async sendMessage(
  //   chatroomId: number,
  //   message: string,
  //   userId: number,
  //   imagePath: string,
  // ) {
  //   const blockData = {
  //     chatroomId,
  //     userId,
  //     message,
  //     imagePath,
  //     timestamp: new Date().toISOString(),
  //   };

  //   // Додаємо блок у блокчейн
  //   const newBlock = this.blockchainService.addBlock(blockData);

  //   // Зберігаємо повідомлення в БД, включаючи хеш блоку
  //   const savedMessage = await this.prisma.message.create({
  //     data: {
  //       chatroomId,
  //       userId,
  //       content: message,
  //       imageUrl: imagePath,
  //       createdAt: new Date(),
  //       blockHash: newBlock.hash, // переконайся, що ця колонка є в схемі
  //     },
  //     include: { user: true, chatroom: { include: { users: true } } },
  //   });

  //   return savedMessage;
  // }

  async sendMessage(
    chatroomId: number,
    message: string,
    userId: number,
    imagePath: string,
  ) {
    const isAnomaly = await this.anomalyService.isAnomalous(message);
    if (isAnomaly) {
      throw new BadRequestException(`Your message is anomaly`);
    }
    const blockData = {
      chatroomId,
      userId,
      content: message,
      imageUrl: imagePath,
    };

    // Додаємо блок у блокчейн
    const savedMessage = await this.blockchainService.addBlock(blockData);

    return savedMessage;
  }

  async aiSendMessage(
    chatroomId: number,
    message: string,
    userId: number,
    imagePath: string,
  ) {
    const aiTrigger = 'любий штучний інтелект дай відповідь:';
    if (message.toLowerCase().startsWith(aiTrigger)) {
      const userQuestion = message.slice(aiTrigger.length).trim();
      console.log('Ключова фраза виявлена. Запит до AI:', userQuestion);

      // Отримуємо відповідь від AI
      const aiResponse = await this.aiService.getAiReply(userQuestion);

      // Додаємо відповідь AI як повідомлення
      const aiBlockData = {
        chatroomId,
        userId: this.aiUserId, // ID системного користувача (AI)
        content: aiResponse,
        imageUrl: '',
      };
      try {
        const aiMessage = this.blockchainService.addBlock(aiBlockData);

        return aiMessage;
      } catch (error) {
        console.log('ai block ' + JSON.stringify(aiBlockData));
        console.error(`EERROR WARNING `, error);
      }
    }

    console.log('Отримано повідомлення:', message);
  }

  async saveImage(image: {
    createReadStream: () => any;
    filename: string;
    mimetype: string;
  }) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validImageTypes.includes(image.mimetype)) {
      throw new BadRequestException({ image: 'Invalid image type' });
    }

    const imageName = `${Date.now()}-${image.filename}`;
    const imagePath = `${this.configService.get('IMAGE_PATH')}/${imageName}`;
    const stream = image.createReadStream();
    const outputPath = `public${imagePath}`;
    const writeStream = createWriteStream(outputPath);
    stream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    return imagePath;
  }

  // async sForChatroom(chatroomId: number) {
  //   return this.blockchainService
  //     .getAll()
  //     .filter((block) => block.data.chatroomId === chatroomId);
  // }

  async getMessagesForChatroom(chatroomId: number) {
    console.log(`you entered in the chat!!!!`);
    const messages: (Message & { isValid?: boolean })[] =
      await this.prisma.message.findMany({
        where: {
          chatroomId: chatroomId,
        },
        include: {
          chatroom: {
            include: {
              users: {
                orderBy: {
                  createdAt: 'asc',
                },
              }, // Eager loading users
            },
          }, // Eager loading Chatroom
          user: true, // Eager loading User
        },
      });

    for (const msg of messages) {
      console.log(`BEFORE` + JSON.stringify(msg));
      const block = await this.blockchainService.getBlockByHash(msg.blockHash);
      console.log(`AFTER ` + JSON.stringify(block));
      let isValid = false;
      if (block) {
        isValid = await this.blockchainService.validateBlockData(block.id);
      }

      console.log(`!!!BLOCK: ${JSON.stringify(block)}`);
      // if (!block || !this.blockchainService.validateBlockData(block, msg)) {
      //   console.log(`!!Message integrity compromised for message ID ${msg.id}`);
      //   // throw new BadRequestException(
      //   //   `Message integrity compromised for message ID ${msg.id}`,
      //   // );
      // }
      msg.isValid = isValid;
    }
    console.log(`THIS MESSAGES ` + JSON.stringify(messages));
    return messages;
  }
  async deleteChatroom(chatroomId: number) {
    return this.prisma.chatroom.delete({
      where: { id: chatroomId },
    });
  }
}
