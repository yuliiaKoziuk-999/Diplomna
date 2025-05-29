// // src/anomaly-detector/anomaly-detector.service.ts
// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class AnomalyService {
//   detectAnomalies(messages: string[]) {
//     throw new Error('Method not implemented.');
//   }
//   trainAutoencoder(messages: string[]) {
//     throw new Error('Method not implemented.');
//   }
//   cacheMessages(messages: string[]) {
//     throw new Error('Method not implemented.');
//   }
//   // Емодзі-детектор
//   detectEmojiAnomaly(message: string): boolean {
//     const emojiRegex = /[\u{1F300}-\u{1F6FF}]/gu;
//     const emojis = message.match(emojiRegex);
//     return emojis ? emojis.length > 5 : false;
//   }

//   // Примітивна перевірка на граматичні аномалії (можна розширити)
//   detectGrammarAnomaly(message: string): boolean {
//     const words = message.trim().split(/\s+/);
//     const averageWordLength =
//       words.reduce((sum, word) => sum + word.length, 0) / words.length;
//     return averageWordLength < 3 || averageWordLength > 10; // просте наближення
//   }

//   // Примітивна перевірка на негативний тон (емоційні слова)
//   detectToneAnomaly(message: string): boolean {
//     const negativeWords = [
//       'дурень',
//       'тупо',
//       'ненавиджу',
//       'клікни',
//       'смерть',
//       'лайно',
//       'тупа система',
//     ];
//     return negativeWords.some((word) => message.toLowerCase().includes(word));
//   }

//   // Комплексна перевірка
//   isAnomalous(message: string): boolean {
//     return (
//       this.detectEmojiAnomaly(message) ||
//       this.detectGrammarAnomaly(message) ||
//       this.detectToneAnomaly(message)
//     );
//   }
// }

//attempt 2
// import { Injectable, Logger } from '@nestjs/common';
// import axios from 'axios';

// @Injectable()
// export class AnomalyService {
//   detectAnomalies(messages: string[]) {
//     throw new Error('Method not implemented.');
//   }
//   trainAutoencoder(messages: string[]) {
//     throw new Error('Method not implemented.');
//   }
//   cacheMessages(messages: string[]) {
//     throw new Error('Method not implemented.');
//   }
//   private readonly apiKey = process.env.ANOMALY_KEY;
//   private readonly logger = new Logger(AnomalyService.name);
//   private readonly apiUrl =
//     'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

//   async isAnomalous(message: string): Promise<boolean> {
//     try {
//       const requestBody = {
//         comment: { text: message },
//         languages: ['en'],
//         requestedAttributes: {
//           TOXICITY: {},
//           SEVERE_TOXICITY: {},
//           PROFANITY: {},
//           THREAT: {},
//           INSULT: {},
//         },
//       };

//       const response = await axios.post(
//         `${this.apiUrl}?key=${this.apiKey}`,
//         requestBody,
//       );

//       const scores = response.data.attributeScores;

//       // логування оцінок
//       this.logger.debug('Perspective scores: ' + JSON.stringify(scores));

//       // Якщо хоча б один індикатор > 0.8, вважаємо повідомлення аномальним
//       const isAnomaly = Object.values(scores).some((attr: any) => {
//         const score = attr.summaryScore.value;
//         return score >= 0.4;
//       });

//       return isAnomaly;
//     } catch (error) {
//       this.logger.error('Perspective API error:', error.message);
//       return false; // на випадок помилки — не блокуємо повідомлення
//     }
//   }
// }

///3 attempt
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class AnomalyService {
  private readonly apiKey = process.env.ANOMALY_KEY;
  private readonly logger = new Logger(AnomalyService.name);
  private readonly apiUrl =
    'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

  // CRON - запускається щохвилини
  // @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.debug('🕒 Cron job running: перевірка останніх повідомлень...');
    const messages = await this.fetchRecentMessages(); // 👈 підключи свою базу

    for (const msg of messages) {
      const isAnomaly = await this.isAnomalous(msg.text);
      this.logger.debug(
        `"${msg.text}" → ${isAnomaly ? '❌ АНОМАЛІЯ' : '✅ норм'}`,
      );
      // TODO: можеш тут оновити статус у БД або надіслати нотифікацію
    }
  }

  // Замінити на реальний запит до твоєї бази (наприклад MongoDB через MessageModel)
  private async fetchRecentMessages(): Promise<{ text: string }[]> {
    return [
      { text: 'You are completely useless in every meeting.' },
      { text: 'Hello team, great job today!' },
    ];
  }

  async isAnomalous(message: string): Promise<boolean> {
    try {
      const requestBody = {
        comment: { text: message },
        languages: ['en'],
        requestedAttributes: {
          TOXICITY: {},
          SEVERE_TOXICITY: {},
          PROFANITY: {},
          THREAT: {},
          INSULT: {},
        },
      };

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        requestBody,
      );

      const scores = response.data.attributeScores;

      this.logger.debug('Perspective scores: ' + JSON.stringify(scores));

      return Object.values(scores).some((attr: any) => {
        const score = attr.summaryScore.value;
        return score >= 0.4;
      });
    } catch (error) {
      this.logger.error('Perspective API error:', error.message);
      return false;
    }
  }

  // Інші методи можна залишити поки не реалізованими
  detectAnomalies(messages: string[]) {
    throw new Error('Method not implemented.');
  }

  trainAutoencoder(messages: string[]) {
    throw new Error('Method not implemented.');
  }

  cacheMessages(messages: string[]) {
    throw new Error('Method not implemented.');
  }
}
