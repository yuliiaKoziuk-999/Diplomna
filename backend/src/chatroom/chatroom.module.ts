import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ChatroomService } from './chatroom.service';
import { ChatroomResolver } from './chatroom.resolver';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { BlockChainService } from 'src/blockchain/block-chain.service';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from 'src/ai/ai.module';
import { AnomalyService } from 'src/anomaly/anomaly.service';
import { RedisService } from 'src/redis/redis.service';
import { Chatroom } from './chatroom.model';
import { Message } from './message.model';
import { User } from 'src/user/user.model';
import { Block } from 'src/blockchain/block.model';
import { ChatroomUsersJoin } from './chatroom-users.model';

@Module({
  imports: [
    ConfigModule,
    AiModule,
    SequelizeModule.forFeature([Chatroom, Message, User, Block, ChatroomUsersJoin]),
  ],
  providers: [
    ChatroomService,
    ChatroomResolver,
    UserService,
    JwtService,
    BlockChainService,
    AnomalyService,
    RedisService,
  ],
})
export class ChatroomModule {}
