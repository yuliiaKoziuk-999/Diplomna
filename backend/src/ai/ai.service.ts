// src/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      baseURL: 'https://api.aimlapi.com/v1',
      apiKey: process.env.API_KEY,
    });
  }

  async getAiReply(message: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-search-preview',
        web_search_options: {},
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      });

      return response.choices?.[0]?.message?.content ?? 'Немає відповіді';
    } catch (error) {
      this.logger.error('AI Error:', error);
      return 'Помилка під час звʼязку з AI';
    }
  }
}
