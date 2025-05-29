// // toxicity.service.ts
// import axios from 'axios';

// const PERSPECTIVE_API_URL =
//   'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';
// const API_KEY = ; // 🔒 бажано зберігати в .env

// export class ToxicityService {
//   static async analyze(text: string) {
//     const request = {
//       comment: { text },
//       languages: ['uk', 'en'],
//       requestedAttributes: {
//         TOXICITY: {},
//         INSULT: {},
//         PROFANITY: {},
//         THREAT: {},
//         IDENTITY_ATTACK: {},
//       },
//     };

//     try {
//       const response = await axios.post(
//         `${PERSPECTIVE_API_URL}?key=${API_KEY}`,
//         request,
//       );
//       return response.data.attributeScores;
//     } catch (error) {
//       console.error('Perspective API error:', error.message);
//       return null;
//     }
//   }

//   static isAnomalous(score: any, threshold = 0.7): boolean {
//     return Object.values(score).some(
//       (attr: any) => attr.summaryScore.value > threshold,
//     );
//   }
// }
