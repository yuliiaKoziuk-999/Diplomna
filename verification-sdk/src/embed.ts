/**
 * The demo backend's feature-hashing embedding, reproduced on the client
 * so the verifier checks the server searched for *this* query instead of
 * trusting its queryVector. MUST match embedText() in
 * backend/src/verifiable-search/query/demo-corpus.ts. With a real model
 * (e.g. sentence-transformers) the client runs the same model instead.
 */
const EMBEDDING_DIM = 24;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embedDemoText(text: string): number[] {
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
