// SPDX-License-Identifier: MIT
// EDUCATIONAL USE ONLY - intentionally vulnerable proxy.
pragma solidity ^0.8.20;

/**
 * SharedWallet.
 *
 * Proxy wallet. Multiple instances of this contract all point at the
 * SAME shared library address. Each proxy stores its own owners,
 * required, initialized in its own storage (delegatecall semantics),
 * but executable code lives in the shared library.
 *
 * If the shared library is selfdestructed, every proxy pointing at it
 * becomes unusable: code at walletLibrary is now empty, so delegatecall
 * returns without doing anything and the proxy can no longer move funds.
 */
contract SharedWallet {
    address[] public owners;
    uint256 public required;
    bool public initialized;

    address public walletLibrary;

    constructor(address libAddr) payable {
        walletLibrary = libAddr;
    }

    fallback() external payable {
        address lib = walletLibrary;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), lib, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
