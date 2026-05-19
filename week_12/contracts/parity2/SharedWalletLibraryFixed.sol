// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SharedWalletLibraryFixed.
 *
 * Two fixes applied:
 *
 *   1. initWallet() refuses direct calls on the library instance. We do
 *      this by tracking `libraryInstance` in immutable storage at deploy
 *      time and rejecting init calls where address(this) equals it - i.e.
 *      where the call is NOT a delegatecall from a proxy.
 *      We also enforce "init once" so a proxy cannot be re-initialized.
 *
 *   2. There is NO killLibrary / selfdestruct entrypoint at all. The
 *      library cannot be removed, so proxies that delegate to it cannot
 *      be frozen by code-disappearance.
 */
contract SharedWalletLibraryFixed {
    address[] public owners;
    uint256 public required;
    bool public initialized;

    // Set at construction. Compared against address(this) to detect
    // "we're running directly on the library, not via delegatecall".
    address private immutable LIBRARY_SELF;

    constructor() {
        LIBRARY_SELF = address(this);
    }

    function initWallet(address[] memory _owners, uint256 _required) public {
        require(address(this) != LIBRARY_SELF, "library instance");
        require(!initialized, "already initialized");
        owners = _owners;
        required = _required;
        initialized = true;
    }

    function execute(address payable to, uint256 value) public {
        require(initialized, "uninitialized");
        require(_isOwner(msg.sender), "not owner");
        (bool ok, ) = to.call{value: value}("");
        require(ok, "send failed");
    }

    // NO killLibrary(). NO selfdestruct.

    function _isOwner(address who) internal view returns (bool) {
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == who) return true;
        }
        return false;
    }
}
