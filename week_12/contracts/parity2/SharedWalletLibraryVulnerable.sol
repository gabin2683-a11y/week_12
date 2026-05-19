// SPDX-License-Identifier: MIT
// EDUCATIONAL USE ONLY - intentionally vulnerable.
pragma solidity ^0.8.20;

/**
 * SharedWalletLibraryVulnerable.
 *
 * Reproduces Parity #2 (November 2017). This library is shared by many
 * proxy wallets via delegatecall. It has two fatal flaws:
 *
 *   1. initWallet() can be called DIRECTLY on the library instance, not
 *      just through a proxy, so an attacker can become the library's own
 *      owner.
 *   2. killLibrary() is a public selfdestruct gated only by the library's
 *      own owner check. Once the attacker is owner of the library, they
 *      can selfdestruct the library.
 *
 * After selfdestruct, every proxy that delegatecalls to this address
 * executes against empty code. Calls revert. Funds in the proxies are
 * NOT transferred to the attacker - they are frozen in place.
 */
contract SharedWalletLibraryVulnerable {
    address[] public owners;
    uint256 public required;
    bool public initialized;

    function initWallet(address[] memory _owners, uint256 _required) public {
        // BUG: no access control on direct calls to the library instance.
        owners = _owners;
        required = _required;
        initialized = true;
    }

    function execute(address payable to, uint256 value) public {
        require(_isOwner(msg.sender), "not owner");
        (bool ok, ) = to.call{value: value}("");
        require(ok, "send failed");
    }

    /**
     * Public kill function. Original Parity wording was "kill".
     * Owner check is on the library's OWN owners[], which the attacker
     * just overwrote via initWallet().
     */
    function killLibrary() public {
        require(_isOwner(msg.sender), "not owner");
        selfdestruct(payable(msg.sender));
    }

    function _isOwner(address who) internal view returns (bool) {
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == who) return true;
        }
        return false;
    }
}
