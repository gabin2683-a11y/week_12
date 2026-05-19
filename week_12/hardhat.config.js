require("@nomicfoundation/hardhat-toolbox");

/**
 * Week 12 lab Hardhat config (Hardhat v2).
 *
 * - All scripts run against the built-in in-memory Hardhat network
 *   (--network hardhat). It is NOT real mainnet. No RPC URL, no private
 *   key, no live deployment.
 * - Solidity EVM version is pinned to "paris" and the Hardhat network
 *   hardfork is "merge" because Parity #2 needs pre-Cancun SELFDESTRUCT
 *   semantics: the code at the library address must actually be removed
 *   so that delegatecall from proxy wallets stops working.
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      hardfork: "merge",
      chainId: 31337,
    },
  },
};
