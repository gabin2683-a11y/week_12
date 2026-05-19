// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SimpleDAO_CEI.
 *
 * Fix: Checks-Effects-Interactions. State is decremented BEFORE the
 * external call, so a reentrant withdraw() sees a balance of 0 and
 * the inner require(balances >= amount) reverts.
 */
contract SimpleDAO_CEI {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        // Checks
        require(balances[msg.sender] >= amount, "insufficient");

        // Effects (state change first)
        balances[msg.sender] -= amount;

        // Interactions (external call last)
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "send failed");
    }

    function daoBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
