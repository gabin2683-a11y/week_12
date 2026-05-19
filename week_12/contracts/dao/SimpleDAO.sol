// SPDX-License-Identifier: MIT
// EDUCATIONAL USE ONLY - intentionally vulnerable.
pragma solidity ^0.8.20;

/**
 * SimpleDAO (VULNERABLE).
 *
 * Bug: withdraw() makes the external call BEFORE decrementing balances,
 * which is the classic DAO reentrancy pattern (June 2016).
 *
 * Note: Solidity 0.8 has built-in over/underflow checks. To preserve the
 * historical "balance underflows" demonstration without using an external
 * SafeMath-style helper, we wrap the decrement in an `unchecked` block.
 * That mirrors the pre-0.8 EVM behavior that the original DAO exhibited.
 */
contract SimpleDAO {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");

        // VULNERABLE: external call before state update
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "send failed");

        unchecked {
            balances[msg.sender] -= amount;
        }
    }

    function daoBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
