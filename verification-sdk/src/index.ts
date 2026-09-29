export { verifySearchResult } from './verify';
export {
  hashLeaf,
  hashPair,
  verifyInclusionProof,
  buildMerkleTree,
  getRangeProof,
  rootFromRange,
} from './merkle';
export type { RangeNode, MerkleBuildResult } from './merkle';
export { vectorLeafHash, centroidLeafHash, euclideanDistance } from './leaves';
export { embedDemoText } from './embed';
export type {
  ProofBundle,
  CentroidEntry,
  RevealedLeaf,
  RangeProof,
  ChainReader,
  VerifyOptions,
  VerificationStep,
  VerificationResult,
} from './types';
export { InMemoryChainReader, BackendMockChainReader } from './chain-readers';
