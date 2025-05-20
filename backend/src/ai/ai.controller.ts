// import { Controller, Post, Body } from '@nestjs/common';
// import { AiService } from './ai.service';

// @Controller('anomaly')
// export class AiController {
//   constructor(private readonly aiService: AiService) {}

//   @Post()
//   check(@Body('values') values: number[]) {
//     const anomalies = this.aiService.detectAnomaly(values);
//     return { anomalies };
//   }
// }

import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('anomaly')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('detect')
  detectAnomaly(@Body('messages') messages: string[]) {
    // Передаємо масив повідомлень у сервіс
    const anomalies = this.aiService.detectAnomaly(messages);

    // Повертаємо клієнту індекси або значення аномалій
    return { anomalies };
  }
}
