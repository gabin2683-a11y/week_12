// SPDX-License-Identifier: MIT
// EDUCATIONAL USE ONLY - intentionally vulnerable.
pragma solidity ^0.8.20;

/**
 * WalletVulnerable.
 *
 * Thin proxy. Every external call that doesn't match a function selector
 * here is forwarded via delegatecall to walletLibrary. The proxy storage
 * layout (owners, required, initialized) intentionally matches the
 * library's layout so that delegatecall writes land in the right slots.
 */
contract WalletVulnerable {
    // Storage layout must align with WalletLibraryVulnerable.
    address[] public owners;
    uint256 public required;
    bool public initialized;

    address public walletLibrary;

    constructor(address libAddr) payable {
        walletLibrary = libAddr;
    }

    // Forward everything to the library. No access control on the entrypoint.
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
