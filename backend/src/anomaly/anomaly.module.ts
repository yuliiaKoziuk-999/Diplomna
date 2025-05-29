// src/modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AnomalyController } from './anomaly.controller';
import { AnomalyService } from './anomaly.service';
// import { AiResolver } from './anomaly.resolver';

@Module({
  providers: [AnomalyService],
  controllers: [AnomalyController],
  exports: [AnomalyService],
})
export class AnomalyModule {}
