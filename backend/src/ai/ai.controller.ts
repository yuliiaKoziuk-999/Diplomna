// src/ai/ai.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async handleAiChat(@Body('message') message: string) {
    const aiReply = await this.aiService.getAiReply(message);
    return { aiReply };
  }
}
