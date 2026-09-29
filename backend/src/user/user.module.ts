import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { JwtService } from '@nestjs/jwt';
import { User } from './user.model';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  providers: [UserService, UserResolver, JwtService],
  exports: [UserService],
})
export class UserModule {}
