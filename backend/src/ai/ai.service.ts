// import { Injectable } from '@nestjs/common';
// import * as tf from '@tensorflow/tfjs';
// import * as natural from 'natural';

// @Injectable()
// export class AiService {
//   // Простий приклад: виявлення аномалій за допомогою одновимірного тензора
//   // detectAnomaly(data: number[]): number[] {
//   //   const tensorData = tf.tensor1d(data);
//   //   const mean = tensorData.mean().dataSync()[0];
//   //   const std = tensorData.sub(mean).square().mean().sqrt().dataSync()[0];

//   //   // Повертаємо самі аномальні значення, а не їх індекси
//   //   const anomalies = data.filter((value) => Math.abs(value - mean) > 2 * std);

//   //   return anomalies;
//   // }

//   // detectAnomaly(messages: string[]): number[] {
//   //   const tfidf = new natural.TfIdf();

//   //   messages.forEach((msg) => tfidf.addDocument(msg));

//   //   // Отримаємо TF-IDF вектори як масиви чисел
//   //   const vectors = [];
//   //   for (let i = 0; i < messages.length; i++) {
//   //     const vec = [];
//   //     tfidf.listTerms(i).forEach((term) => {
//   //       vec.push(term.tfidf);
//   //     });
//   //     vectors.push(vec);
//   //   }

//   //   // Тепер можна застосувати кластеризацію, наприклад ml-kmeans,
//   //   // або обчислити евклідову відстань між векторами

//   //   // Для простоти повернемо індекси повідомлень з найдовшими векторами (приклад)
//   //   const lengths = vectors.map((v) => v.reduce((sum, val) => sum + val, 0));
//   //   const maxLength = Math.max(...lengths);

//   //   return lengths
//   //     .map((val, idx) => ({ val, idx }))
//   //     .filter((item) => item.val === maxLength)
//   //     .map((item) => item.idx);
//   // }

//   detectAnomaly(messages: string[]): number[] {
//     // Визначимо просту ознаку: довжина кожного повідомлення
//     const lengths = messages.map((msg) => msg.length);

//     // Обчислимо середнє і стандартне відхилення довжин
//     const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
//     const variance =
//       lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
//     const std = Math.sqrt(variance);

//     // Позначимо аномальними ті повідомлення, довжина яких виходить за 2 стандартних відхилення від середнього
//     const anomalies = lengths.map((len) =>
//       Math.abs(len - mean) > 1 * std ? 1 : 0,
//     );

//     return anomalies; // 1 — аномалія, 0 — нормальне
//   }

//   async detectAnomalyAutoencoder(messages: string[]): Promise<number[]> {
//     // 1. Закодуємо повідомлення (тут просто довжина нормалізована)
//     const data = messages.map((msg) => [msg.length / 100]);
//     const xs = tf.tensor2d(data);

//     // 2. Створюємо автоенкодер
//     const input = tf.input({ shape: [1] });
//     const encoded = tf.layers
//       .dense({ units: 1, activation: 'relu' })
//       .apply(input) as tf.SymbolicTensor;
//     const decoded = tf.layers
//       .dense({ units: 1, activation: 'linear' })
//       .apply(encoded) as tf.SymbolicTensor;

//     const autoencoder = tf.model({ inputs: input, outputs: decoded });
//     autoencoder.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

//     // 3. Навчаємо модель
//     await autoencoder.fit(xs, xs, { epochs: 100 });

//     // 4. Прогнозуємо
//     const preds = autoencoder.predict(xs) as tf.Tensor;
//     const predsData = (await preds.array()) as number[][];

//     // 5. Обчислюємо помилки реконструкції
//     const errors = data.map((val, i) => Math.abs(val[0] - predsData[i][0]));

//     // 6. Поріг для виявлення аномалій (налаштуй, якщо треба)
//     const threshold = 0.05;

//     // 7. Визначаємо аномалії: 1 — аномалія, 0 — ні
//     const anomalies = errors.map((err) => (err > threshold ? 1 : 0));

//     return anomalies;
//   }
// }

import { Injectable } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
@Injectable()
export class AiService {
  private model: tf.LayersModel | null = null;

  // Функція екстракції фіч
  private extractFeatures(message: string): number[] {
    const length = message.length;
    const wordCount = message.trim().split(/\s+/).length;
    const uppercaseCount = (message.match(/[A-ZА-ЯЁЇІЄҐ]/g) || []).length;
    const digitCount = (message.match(/\d/g) || []).length;
    const punctuationCount = (message.match(/[.,!?;:]/g) || []).length;

    return [length, wordCount, uppercaseCount, digitCount, punctuationCount];
  }

  // Функція для нормалізації фіч (мін-макс нормалізація)
  private normalizeFeatures(features: number[][]): number[][] {
    const transposed = features[0].map((_, colIndex) =>
      features.map((row) => row[colIndex]),
    );

    const mins = transposed.map((col) => Math.min(...col));
    const maxs = transposed.map((col) => Math.max(...col));

    return features.map((row) =>
      row.map((val, i) =>
        maxs[i] - mins[i] === 0 ? 0 : (val - mins[i]) / (maxs[i] - mins[i]),
      ),
    );
  }

  // Створення та навчання автоенкодера
  async trainAutoencoder(messages: string[]) {
    const features = messages.map((msg) => this.extractFeatures(msg));
    const normalizedFeatures = this.normalizeFeatures(features);

    const inputDim = normalizedFeatures[0].length;

    // Модель автоенкодера
    const input = tf.input({ shape: [inputDim] });
    const encoded = tf.layers
      .dense({ units: 3, activation: 'relu' })
      .apply(input) as tf.SymbolicTensor;
    const decoded = tf.layers
      .dense({ units: inputDim, activation: 'sigmoid' })
      .apply(encoded) as tf.SymbolicTensor;

    this.model = tf.model({ inputs: input, outputs: decoded });
    this.model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

    const xs = tf.tensor2d(normalizedFeatures);

    // Навчаємо модель (наприклад, 100 епох)
    await this.model.fit(xs, xs, {
      epochs: 100,
      verbose: 0,
    });

    xs.dispose();
  }

  // Виявлення аномалій (повідомлення передаються для перевірки)
  detectAnomalies(messages: string[]): number[] {
    if (!this.model) {
      throw new Error('Model not trained yet');
    }

    const features = messages.map((msg) => this.extractFeatures(msg));
    const normalizedFeatures = this.normalizeFeatures(features);
    const xs = tf.tensor2d(normalizedFeatures);

    // Передбачаємо декодовані дані
    const decoded = this.model.predict(xs) as tf.Tensor;
    const decodedArray = decoded.arraySync() as number[][];

    xs.dispose();
    decoded.dispose();

    // Визначаємо похибку реконструкції для кожного зразка
    const errors = normalizedFeatures.map((feat, i) =>
      feat.reduce(
        (sum, val, j) => sum + Math.pow(val - decodedArray[i][j], 2),
        0,
      ),
    );

    // Поріг аномалії - середнє + 2 стандартних відхилення (можна регулювати)
    const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
    const std = Math.sqrt(
      errors.reduce((sum, e) => sum + (e - mean) ** 2, 0) / errors.length,
    );
    const threshold = 1;

    console.log('Errors:', errors);
    console.log('Mean:', mean);
    console.log('Std:', std);
    console.log('Threshold:', threshold);

    // Повертаємо 1, якщо аномалія, і 0 - якщо ні
    return errors.map((e) => (e > threshold ? 1 : 0));
  }
}
