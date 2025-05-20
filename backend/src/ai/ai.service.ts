import { Injectable } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import * as natural from 'natural';

@Injectable()
export class AiService {
  // Простий приклад: виявлення аномалій за допомогою одновимірного тензора
  // detectAnomaly(data: number[]): number[] {
  //   const tensorData = tf.tensor1d(data);
  //   const mean = tensorData.mean().dataSync()[0];
  //   const std = tensorData.sub(mean).square().mean().sqrt().dataSync()[0];

  //   // Повертаємо самі аномальні значення, а не їх індекси
  //   const anomalies = data.filter((value) => Math.abs(value - mean) > 2 * std);

  //   return anomalies;
  // }

  detectAnomaly(messages: string[]): number[] {
    const tfidf = new natural.TfIdf();

    messages.forEach((msg) => tfidf.addDocument(msg));

    // Отримаємо TF-IDF вектори як масиви чисел
    const vectors = [];
    for (let i = 0; i < messages.length; i++) {
      const vec = [];
      tfidf.listTerms(i).forEach((term) => {
        vec.push(term.tfidf);
      });
      vectors.push(vec);
    }

    // Тепер можна застосувати кластеризацію, наприклад ml-kmeans,
    // або обчислити евклідову відстань між векторами

    // Для простоти повернемо індекси повідомлень з найдовшими векторами (приклад)
    const lengths = vectors.map((v) => v.reduce((sum, val) => sum + val, 0));
    const maxLength = Math.max(...lengths);

    return lengths
      .map((val, idx) => ({ val, idx }))
      .filter((item) => item.val === maxLength)
      .map((item) => item.idx);
  }
}
