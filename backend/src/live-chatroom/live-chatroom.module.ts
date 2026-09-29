import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LiveChatroomResolver } from './live-chatroom.resolver';
import { LiveChatroomService } from './live-chatroom.service';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/user/user.model';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  providers: [LiveChatroomResolver, LiveChatroomService, UserService, JwtService],
})
export class LiveChatroomModule {}
