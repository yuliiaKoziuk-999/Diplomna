import * as SHA256 from 'crypto-js/sha256';

export class Block {
  index: number;
  timestamp: Date;
  data: any;
  previousHash: string;
  hash: string;
  nonce: number;

  constructor(
    index: number,
    timestamp: Date,
    data: any,
    previousHash = '',
    hash?: string,
    nonce = 0,
  ) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = hash || this.calculateHash();
  }

  calculateHash(): string {
    return SHA256(
      this.index +
        this.previousHash +
        this.timestamp.toISOString() +
        JSON.stringify(this.data) +
        this.nonce,
    ).toString();
  }

  static fromJSON(json: string): Block {
    const obj = JSON.parse(json);
    return new Block(
      obj.index,
      new Date(obj.timestamp),
      obj.data,
      obj.previousHash,
      obj.hash,
      obj.nonce,
    );
  }
}
