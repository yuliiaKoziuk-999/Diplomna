import { Module } from '@nestjs/common';
import { ChatroomService } from './chatroom.service';
import { ChatroomResolver } from './chatroom.resolver';
import { PrismaService } from 'src/prisma.service';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { BlockChainService } from 'src/blockchain/block-chain.service';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from 'src/ai/ai.module';
import { AnomalyService } from 'src/anomaly/anomaly.service';

@Module({
  imports: [ConfigModule, AiModule],
  providers: [
    ChatroomService,
    ChatroomResolver,
    PrismaService,
    UserService,
    JwtService,
    BlockChainService,
    AnomalyService,
  ],
})
export class ChatroomModule {}
