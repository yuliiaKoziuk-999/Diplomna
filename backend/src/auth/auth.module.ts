import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/user/user.model';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  providers: [AuthResolver, AuthService, JwtService],
})
export class AuthModule {}
