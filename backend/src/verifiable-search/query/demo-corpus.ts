/**
 * Demo corpus + a deterministic feature-hashing "embedding" — real text,
 * real (if crude) vectors, just not a trained model. Swap embedText() for
 * `openai` embeddings (already a tech-stack.md dependency) once there is
 * a real corpus; nothing else in the module depends on how vectors are
 * produced.
 */

export interface DemoDocument {
  id: string;
  text: string;
}

export const DEMO_CORPUS: DemoDocument[] = [
  { id: 'd1', text: 'IVF-індекс ділить вектори на кластери за найближчим центроїдом' },
  { id: 'd2', text: 'HNSW будує граф найближчих сусідів для наближеного пошуку' },
  { id: 'd3', text: 'Дерево Меркла дає компактний доказ включення елемента' },
  { id: 'd4', text: 'Keccak256 — хеш-функція, вбудована в EVM і Solidity' },
  { id: 'd5', text: 'Смарт-контракт MerkleAnchor зберігає корінь дерева для кожної версії' },
  { id: 'd6', text: 'Polygon PoS має дешевші транзакції ніж Ethereum mainnet' },
  { id: 'd7', text: 'Polygon Amoy — тестова мережа для розробки смарт-контрактів' },
  { id: 'd8', text: 'Rollback-атака показує клієнту застарілу версію індексу' },
  { id: 'd9', text: 'Equivocation-атака показує різним клієнтам різні версії правди' },
  { id: 'd10', text: 'Incompleteness-атака приховує релевантні результати пошуку' },
  { id: 'd11', text: 'Range-proof доводить відсутність пропущеного елемента між сусідами' },
  { id: 'd12', text: 'Authenticated skip list дає ефективний proof of non-membership' },
  { id: 'd13', text: 'RAG-система доповнює відповідь LLM релевантними документами' },
  { id: 'd14', text: 'Векторна база даних зберігає embeddings для семантичного пошуку' },
  { id: 'd15', text: 'Recall at k вимірює частку релевантних результатів серед топ k' },
  { id: 'd16', text: 'Gas cost анкорення залежить від частоти батчингу транзакцій' },
  { id: 'd17', text: 'Верифікація на клієнті не повинна довіряти серверу пошуку' },
  { id: 'd18', text: 'viem дає типізований доступ до контрактів у TypeScript' },
  { id: 'd19', text: 'Hardhat дозволяє тестувати й деплоїти Solidity-контракти' },
  { id: 'd20', text: 'EU AI Act вимагає прозорості й простежуваності ШІ-систем' },
  { id: 'd21', text: 'Anchoring-as-a-Service батчить хеші перед записом у блокчейн' },
  { id: 'd22', text: 'OpenTimestamps анкорить хеші документів у мережу Bitcoin' },
  { id: 'd23', text: 'k-means кластеризує вектори навколо k центроїдів' },
  { id: 'd24', text: 'Proof bundle містить докази включення для кожного результату' },
  { id: 'd25', text: 'Nprobe визначає скільки найближчих кластерів пробує IVF-пошук' },
  { id: 'd26', text: 'Централізований vector store може приховати частину результатів' },
  { id: 'd27', text: 'Merkle Patricia Trie використовується в Ethereum для стану акаунтів' },
  { id: 'd28', text: 'Compliance-модуль анкорить журнал запитів для аудиту ШІ' },
  { id: 'd29', text: 'Sentence-transformers перетворює текст у щільний вектор ознак' },
  { id: 'd30', text: 'Верифіковане семантичне пошук поєднує ANN-індекс і криптографію' },
];

const EMBEDDING_DIM = 24;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Feature-hashing bag-of-words — a real (if simple) embedding technique,
 * deterministic, no external model or network call needed for the demo. */
export function embedText(text: string): number[] {
  const vector = new Array(EMBEDDING_DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-zа-яіїєґ0-9]+/gi) ?? [];
  for (const token of tokens) {
    const h = hashToken(token);
    const bucket = h % EMBEDDING_DIM;
    const sign = h & 1 ? 1 : -1;
    vector[bucket] += sign;
  }
  const norm = Math.sqrt(vector.reduce((s, x) => s + x * x, 0)) || 1;
  return vector.map((x) => x / norm);
}
