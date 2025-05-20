import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import { BlockChainService } from 'src/blockchain/block-chain.service';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ChatroomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly blockchainService: BlockChainService,
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
    return this.prisma.chatroom.create({
      data: {
        name,
        users: {
          connect: {
            id: sub,
          },
        },
      },
    });
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

  async sendMessage(
    chatroomId: number,
    message: string,
    userId: number,
    imagePath: string,
  ) {
    const blockData = {
      chatroomId,
      userId,
      message,
      imagePath,
      timestamp: new Date().toISOString(),
    };

    // Додаємо блок у блокчейн
    const newBlock = this.blockchainService.addBlock(blockData);

    // Зберігаємо повідомлення в БД, включаючи хеш блоку
    const savedMessage = await this.prisma.message.create({
      data: {
        chatroomId,
        userId,
        content: message,
        imageUrl: imagePath,
        createdAt: new Date(),
        blockHash: newBlock.hash, // переконайся, що ця колонка є в схемі
      },
      include: { user: true, chatroom: { include: { users: true } } },
    });

    return savedMessage;
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
    const messages = await this.prisma.message.findMany({
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
      const block = this.blockchainService.getBlockByHash(msg.blockHash);

      if (!block || !this.blockchainService.validateBlockData(block, msg)) {
        console.log(`!!Message integrity compromised for message ID ${msg.id}`);
        throw new BadRequestException(
          `Message integrity compromised for message ID ${msg.id}`,
        );
      }
    }

    return messages;
  }
  async deleteChatroom(chatroomId: number) {
    return this.prisma.chatroom.delete({
      where: { id: chatroomId },
    });
  }
}
