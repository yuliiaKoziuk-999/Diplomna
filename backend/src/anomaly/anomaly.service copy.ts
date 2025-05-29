// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
// import * as fs from 'fs';
// import { execSync } from 'child_process';
// import * as stringSimilarity from 'string-similarity';

// @Injectable()
// export class AnomalyService1 implements OnModuleInit {
//   onModuleInit() {
//     this.logger.log('Running initial model training...');
//     this.handleScheduledTraining();
//   }
//   private readonly logger = new Logger(AnomalyService.name);

//   private cachedMessages: string[] = [];
//   private trainedPatterns: Set<string> = new Set();
//   private loadMessagesFromFile(): string[] {
//     try {
//       const data = fs.readFileSync('src/anomaly/data/messages.json', 'utf8');
//       const parsed = JSON.parse(data);
//       if (!Array.isArray(parsed.messages)) {
//         throw new Error('Invalid messages file format');
//       }
//       return parsed.messages;
//     } catch (error) {
//       this.logger.error('Failed to load messages from file:', error.message);
//       return [];
//     }
//   }

//   // Кешування повідомлень вручну через контролер
//   cacheMessages(messages: string[]) {
//     if (!Array.isArray(messages)) {
//       throw new Error('Messages must be an array');
//     }
//     this.cachedMessages = messages;
//     this.logger.log(
//       `Cached ${messages.length} messages for scheduled training`,
//     );
//   }

//   // Навчання моделі (спрощено, просто зберігає шаблони)
//   trainAutoencoder(messages: string[]) {
//     if (!Array.isArray(messages)) {
//       throw new Error('Messages must be an array');
//     }
//     this.trainedPatterns = new Set(messages);
//     this.logger.log(`Model trained with ${messages.length} messages`);
//   }

//   // Виявлення аномалій (простий підхід)
//   detectAnomalies(messages: string[]): number[] {
//     const trained = Array.from(this.trainedPatterns);
//     return messages.map((msg) => {
//       const { bestMatch } = stringSimilarity.findBestMatch(msg, trained);
//       return bestMatch.rating >= 0.8 ? 0 : 1; // поріг можна змінити
//     });
//   }

//   // Cron job: щохвилини тренувати модель на основі messages.json
//   @Cron(CronExpression.EVERY_MINUTE)
//   handleScheduledTraining() {
//     try {
//       // 🔄 1. Генерація нових даних
//       this.logger.log('Generating new messages with faker.js...');
//       execSync('node src/anomaly/data/faker.js'); // шлях до faker.js

//       // 📥 2. Завантаження повідомлень з новоствореного файлу
//       const messages = this.loadMessagesFromFile();

//       if (messages.length === 0) {
//         this.logger.warn('No messages loaded for training');
//         return;
//       }

//       // ✅ Лог першого повідомлення
//       this.logger.log('Example message: ' + messages[0]);

//       // 📚 3. Навчання моделі
//       this.trainAutoencoder(messages);
//       this.logger.log('Scheduled training completed');
//     } catch (error) {
//       this.logger.error('Scheduled training failed:', error.message);
//     }
//   }
// }
