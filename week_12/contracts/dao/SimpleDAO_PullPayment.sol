// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SimpleDAO_PullPayment.
 *
 * Fix: pull-over-push. withdraw() does NOT call the user back. It queues
 * a credit, and the user pulls via claim(). Reentrancy via receive() is
 * impossible during the first withdraw() because no Ether is sent yet.
 */
contract SimpleDAO_PullPayment {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public credits;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        balances[msg.sender] -= amount;
        credits[msg.sender] += amount;
    }

    function claim() external {
        uint256 owed = credits[msg.sender];
        require(owed > 0, "no credit");
        credits[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: owed}("");
        require(ok, "send failed");
    }

    function daoBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
