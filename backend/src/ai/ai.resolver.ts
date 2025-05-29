import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AiService } from './ai.service';

@Resolver()
export class AiResolver {
  constructor(private readonly aiService: AiService) {}

  @Mutation(() => String)
  async aiReply(@Args('message') message: string): Promise<string> {
    return this.aiService.getAiReply(message);
  }
}
