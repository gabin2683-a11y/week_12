// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * WalletFixed.
 *
 * Fix: ownership is set in the constructor, and a re-entry guard on
 * initWallet() (initialized flag + onlyUninitialized modifier) prevents
 * the proxy from being re-initialized via delegatecall fallback.
 *
 * Storage layout still mirrors the library so delegatecall semantics work.
 */
contract WalletFixed {
    address[] public owners;
    uint256 public required;
    bool public initialized;

    address public walletLibrary;

    modifier onlyOwner() {
        bool isOwner = false;
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == msg.sender) { isOwner = true; break; }
        }
        require(isOwner, "not owner");
        _;
    }

    constructor(address libAddr, address[] memory _owners, uint256 _required) payable {
        walletLibrary = libAddr;
        owners = _owners;
        required = _required;
        initialized = true;
    }

    function initWallet(address[] memory, uint256) external pure {
        revert("already initialized");
    }

    function execute(address payable to, uint256 value) external onlyOwner {
        (bool ok, ) = to.call{value: value}("");
        require(ok, "send failed");
    }

    receive() external payable {}
}
