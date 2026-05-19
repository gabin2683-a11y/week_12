// SPDX-License-Identifier: MIT
// EDUCATIONAL USE ONLY - intentionally vulnerable.
pragma solidity ^0.8.20;

/**
 * WalletLibraryVulnerable.
 *
 * Reproduces Parity #1 (July 2017). initWallet() has no access control and
 * is callable on every proxy via delegatecall fallback. Because delegatecall
 * runs library code in the PROXY's storage context, an attacker who calls
 * initWallet([attacker], 1) on an uninitialized proxy rewrites the proxy's
 * owners[0] slot to themselves and then drains the wallet via execute().
 */
contract WalletLibraryVulnerable {
    address[] public owners;
    uint256 public required;
    bool public initialized;

    function initWallet(address[] memory _owners, uint256 _required) public {
        // BUG: no access control, no "only once" guard enforced at proxy level.
        owners = _owners;
        required = _required;
        initialized = true;
    }

    function execute(address payable to, uint256 value) public {
        require(_isOwner(msg.sender), "not owner");
        (bool ok, ) = to.call{value: value}("");
        require(ok, "send failed");
    }

    function _isOwner(address who) internal view returns (bool) {
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == who) return true;
        }
        return false;
    }
}
