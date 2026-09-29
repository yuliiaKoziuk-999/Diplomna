import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { createWriteStream } from 'fs';
import { AiService } from 'src/ai/ai.service';
import { AnomalyService } from 'src/anomaly/anomaly.service';
import { BlockChainService } from 'src/blockchain/block-chain.service';
import { Chatroom } from './chatroom.model';
import { Message } from './message.model';
import { User } from 'src/user/user.model';
import { Op } from 'sequelize';

@Injectable()
export class ChatroomService {
  private aiUserId = 100001;
  constructor(
    @InjectModel(Chatroom) private readonly chatroomModel: typeof Chatroom,
    @InjectModel(Message) private readonly messageModel: typeof Message,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly configService: ConfigService,
    private readonly blockchainService: BlockChainService,
    private readonly aiService: AiService,
    private readonly anomalyService: AnomalyService,
  ) {}

  async getChatroom(id: string) {
    return this.chatroomModel.findByPk(parseInt(id));
  }

  async createChatroom(name: string, sub: number) {
    const existingChatroom = await this.chatroomModel.findOne({
      where: { name },
    });
    if (existingChatroom) {
      throw new BadRequestException({ name: 'Chatroom already exists' });
    }
    const chat = await this.chatroomModel.create({ name });
    await chat.addUsers([sub, this.aiUserId]);

    return chat;
  }

  async addUsersToChatroom(chatroomId: number, userIds: number[]) {
    const existingChatroom = await this.chatroomModel.findByPk(chatroomId);
    if (!existingChatroom) {
      throw new BadRequestException({ chatroomId: 'Chatroom does not exist' });
    }

    await existingChatroom.addUsers(userIds);

    return this.chatroomModel.findByPk(chatroomId, {
      include: [{ model: User, as: 'users' }],
    });
  }

  async getChatroomsForUser(userId: number) {
    const membership = await this.userModel.findByPk(userId, {
      include: [{ model: Chatroom, as: 'chatrooms', attributes: ['id'] }],
    });
    const chatroomIds = membership?.chatrooms.map((chatroom) => chatroom.id) ?? [];
    if (chatroomIds.length === 0) {
      return [];
    }

    return this.chatroomModel.findAll({
      where: {
        id: { [Op.in]: chatroomIds },
      },
      include: [
        { model: User, as: 'users' },
        {
          model: Message,
          as: 'messages',
          separate: true,
          limit: 1,
          order: [['createdAt', 'DESC']],
        },
      ],
      order: [[{ model: User, as: 'users' }, 'createdAt', 'DESC']],
    });
  }

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

  async getMessagesForChatroom(chatroomId: number) {
    console.log(`you entered in the chat!!!!`);
    const messages: (Message & { isValid?: boolean })[] =
      await this.messageModel.findAll({
        where: {
          chatroomId: chatroomId,
        },
        include: [
          {
            model: Chatroom,
            as: 'chatroom',
            include: [{ model: User, as: 'users' }], // Eager loading users
          }, // Eager loading Chatroom
          { model: User, as: 'user' }, // Eager loading User
        ],
        order: [
          [
            { model: Chatroom, as: 'chatroom' },
            { model: User, as: 'users' },
            'createdAt',
            'ASC',
          ],
        ],
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
      msg.isValid = isValid;
    }
    console.log(`THIS MESSAGES ` + JSON.stringify(messages));
    return messages;
  }
  async deleteChatroom(chatroomId: number) {
    return this.chatroomModel.destroy({ where: { id: chatroomId } });
  }
}
