// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SimpleDAO_Guard.
 *
 * Fix: nonReentrant lock. A reentrant call inside the same external
 * function reverts because _locked is still 1 when the attacker's
 * receive() tries to call withdraw() again.
 */
contract SimpleDAO_Guard {
    mapping(address => uint256) public balances;
    uint256 private _locked = 1;

    modifier nonReentrant() {
        require(_locked == 1, "reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "insufficient");

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "send failed");

        balances[msg.sender] -= amount;
    }

    function daoBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
