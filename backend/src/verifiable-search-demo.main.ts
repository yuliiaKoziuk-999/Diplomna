/**
 * Standalone demo entry point — boots ONLY VerifiableSearchModule, no
 * Postgres/Redis/GraphQL, so the real REST module can be demoed without
 * the rest of backend/ (which needs docker-compose up). Once the full
 * app boots normally, this module is already wired into app.module.ts
 * and this file is no longer needed for that path.
 *
 * Run: npx ts-node -T src/verifiable-search-demo.main.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, ValidationPipe } from '@nestjs/common';
import { VerifiableSearchModule } from './verifiable-search/verifiable-search.module';

@Module({ imports: [VerifiableSearchModule] })
class DemoAppModule {}

async function bootstrap() {
  const app = await NestFactory.create(DemoAppModule);
  app.enableCors({ origin: ['http://localhost:5173', 'http://localhost:5174'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3000);
  console.log('verifiable-search demo API on http://localhost:3000');
}
bootstrap();
