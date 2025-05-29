import { Controller, Post, Body } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller('anomaly')
export class AnomalyController {
  constructor(private readonly anomalyService: AnomalyService) {}
  @Post('cache')
  cacheMessages(@Body('messages') messages: string[]) {
    console.log('Received messages:', messages);
    this.anomalyService.cacheMessages(messages);
    return { status: 'Messages cached for scheduled training' };
  }
  @Post('check-message')
  async checkMessage(@Body('text') text: string) {
    const result = await this.anomalyService.isAnomalous(text);
    return { isAnomalous: result };
  }

  @Post('train')
  async train(@Body('messages') messages: string[]) {
    await this.anomalyService.trainAutoencoder(messages);
    return { status: 'Model trained' };
  }

  @Post('detect-autoencoder')
  detectAutoencoder(@Body('messages') messages: string[]) {
    try {
      const anomalies = this.anomalyService.detectAnomalies(messages);
      return { anomalies };
    } catch (e) {
      return { error: e.message };
    }
  }
}
