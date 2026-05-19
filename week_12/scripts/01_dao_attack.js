const { ethers } = require("hardhat");
const { openLog, fmtEth } = require("./lib");

async function main() {
  const log = openLog("dao_attack.log");
  log.write("=== Week 12 Part 1: DAO Reentrancy Attack ===");
  log.write("Network: hardhatMainnet (local Hardhat in-memory)");
  log.write("");

  const [deployer, victim, attackerEOA] = await ethers.getSigners();

  // Deploy vulnerable DAO
  const SimpleDAO = await ethers.getContractFactory("SimpleDAO");
  const dao = await SimpleDAO.deploy();
  await dao.waitForDeployment();
  log.write("Deployed SimpleDAO        : " + (await dao.getAddress()));

  // Victim deposits 10 ETH
  await dao.connect(victim).deposit({ value: ethers.parseEther("10") });
  log.write("Victim deposited          : 10 ETH");
  log.write("DAO balance after deposit : " + fmtEth(ethers, await ethers.provider.getBalance(await dao.getAddress())));

  // Deploy attacker contract seeded with 1 ETH
  const DAOAttacker = await ethers.getContractFactory("DAOAttacker");
  const attacker = await DAOAttacker.connect(attackerEOA).deploy(
    await dao.getAddress(),
    { value: ethers.parseEther("1") }
  );
  await attacker.waitForDeployment();
  log.write("Deployed DAOAttacker      : " + (await attacker.getAddress()));
  log.write("Attacker seed             : 1 ETH");
  log.write("");

  log.write("--- Launching reentrancy attack ---");
  await attacker.connect(attackerEOA).attack();

  const daoBalAfter = await ethers.provider.getBalance(await dao.getAddress());
  const attackerBalAfter = await ethers.provider.getBalance(await attacker.getAddress());

  log.write("DAO balance after attack  : " + fmtEth(ethers, daoBalAfter));
  log.write("Attacker contract balance : " + fmtEth(ethers, attackerBalAfter));
  log.write("");

  if (daoBalAfter === 0n) {
    log.write("RESULT: DAO drained to 0 ETH. Reentrancy attack succeeded.");
  } else {
    log.write("RESULT: DAO not fully drained. Remaining: " + fmtEth(ethers, daoBalAfter));
  }

  await log.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
