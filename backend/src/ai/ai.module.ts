// src/modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiResolver } from './ai.resolver';

@Module({
  providers: [AiService, AiResolver],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
