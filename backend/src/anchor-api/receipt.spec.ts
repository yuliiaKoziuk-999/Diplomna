import { createHash } from 'crypto';
import { buildMerkleTree, getInclusionProof, hashLeaf } from 'src/verifiable-search/merkle/merkle-tree';
// The cabinet verifies receipts with the client SDK, so its hashing must agree with the backend's.
import { hashLeaf as sdkHashLeaf, verifyInclusionProof as sdkVerify } from '../../../verification-sdk/src/merkle';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('document receipts', () => {
  const hashes = ['a', 'b', 'c', 'd', 'e'].map(sha); // odd count exercises the carried-up node
  const tree = buildMerkleTree(hashes.map(hashLeaf));

  it('verify in the client SDK for every batch position', () => {
    hashes.forEach((h, i) => {
      const { siblings } = getInclusionProof(tree.layers, i);
      expect(sdkHashLeaf(h)).toBe(hashLeaf(h));
      expect(sdkVerify(sdkHashLeaf(h), siblings, tree.root)).toBe(true);
    });
  });

  it('fail for a document that was not in the batch', () => {
    const { siblings } = getInclusionProof(tree.layers, 0);
    expect(sdkVerify(sdkHashLeaf(sha('z')), siblings, tree.root)).toBe(false);
  });
});
