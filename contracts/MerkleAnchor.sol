// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Registry of Merkle roots for verifiable-search / AnchorProof.
 * Deliberately minimal to keep gas cost low (see docs/thesis-plan.md,
 * section 6): one mapping write and one event per anchored version.
 *
 * NOT YET DEPLOYED — the backend's AnchoringService
 * (backend/src/verifiable-search/anchoring) mocks this contract's
 * read/write shape in-memory until Hardhat + a Polygon Amoy deployment
 * are set up (tracked task: "Hardhat-проект + деплой MerkleAnchor.sol").
 */
contract MerkleAnchor {
    struct Anchor {
        bytes32 root;
        uint64 timestamp;
    }

    mapping(uint256 => Anchor) public anchors; // version => Anchor
    uint256 public latestVersion;
    address public indexer; // address allowed to anchor

    event RootAnchored(uint256 indexed version, bytes32 root, uint64 timestamp);

    modifier onlyIndexer() {
        require(msg.sender == indexer, "not authorized");
        _;
    }

    constructor(address _indexer) {
        indexer = _indexer;
    }

    function anchorRoot(bytes32 root) external onlyIndexer {
        latestVersion += 1;
        anchors[latestVersion] = Anchor(root, uint64(block.timestamp));
        emit RootAnchored(latestVersion, root, uint64(block.timestamp));
    }

    function getRoot(uint256 version) external view returns (bytes32, uint64) {
        Anchor memory a = anchors[version];
        return (a.root, a.timestamp);
    }
}
