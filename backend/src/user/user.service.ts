import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as fs from 'fs';
import { join } from 'path';
import { Op } from 'sequelize';
import { User } from './user.model';
import { Chatroom } from 'src/chatroom/chatroom.model';

@Injectable()
export class UserService {
  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  async updateProfile(userId: number, fullname: string, avatarUrl: string) {
    const user = await this.userModel.findByPk(userId);

    if (avatarUrl) {
      const oldAvatarUrl = user.avatarUrl;

      user.fullname = fullname;
      user.avatarUrl = avatarUrl;
      await user.save();

      if (oldAvatarUrl) {
        const imageName = oldAvatarUrl.split('/').pop();
        const imagePath = join(
          __dirname,
          '..',
          '..',
          'public',
          'images',
          imageName,
        );
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      return user;
    }

    user.fullname = fullname;
    await user.save();
    return user;
  }

  async searchUsers(fullname: string, userId: number) {
    // make sure that users are found that contain part of the fullname
    // and exclude the current user
    return this.userModel.findAll({
      where: {
        fullname: {
          [Op.like]: `%${fullname}%`,
        },
        id: {
          [Op.ne]: userId,
        },
      },
    });
  }

  async getUsersOfChatroom(chatroomId: number) {
    return this.userModel.findAll({
      include: [
        {
          model: Chatroom,
          as: 'chatrooms',
          where: { id: chatroomId },
          attributes: [],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async getUser(userId: number) {
    return this.userModel.findByPk(userId);
  }
}
