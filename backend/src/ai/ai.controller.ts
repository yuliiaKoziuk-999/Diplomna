// // import { Controller, Post, Body } from '@nestjs/common';
// // import { AiService } from './ai.service';

// // @Controller('anomaly')
// // export class AiController {
// //   constructor(private readonly aiService: AiService) {}

// //   @Post()
// //   check(@Body('values') values: number[]) {
// //     const anomalies = this.aiService.detectAnomaly(values);
// //     return { anomalies };
// //   }
// // }

// import { Controller, Post, Body } from '@nestjs/common';
// import { AiService } from './ai.service';

// @Controller('anomaly')
// export class AiController {
//   constructor(private readonly aiService: AiService) {}

//   @Post('detect')
//   detectAnomaly(@Body('messages') messages: string[]) {
//     // Передаємо масив повідомлень у сервіс
//     const anomalies = this.aiService.detectAnomaly(messages);

//     // Повертаємо клієнту індекси або значення аномалій
//     return { anomalies };
//   }

//   @Post('detect-autoencoder')
//   async detectAnomalyAutoencoder(@Body('messages') messages: string[]) {
//     const anomalies = await this.aiService.detectAnomalyAutoencoder(messages);
//     return { anomalies };
//   }
// }

import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
@Controller('anomaly')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('train')
  async train(@Body('messages') messages: string[]) {
    await this.aiService.trainAutoencoder(messages);
    return { status: 'Model trained' };
  }

  @Post('detect-autoencoder')
  detectAutoencoder(@Body('messages') messages: string[]) {
    try {
      const anomalies = this.aiService.detectAnomalies(messages);
      return { anomalies };
    } catch (e) {
      return { error: e.message };
    }
  }
}
