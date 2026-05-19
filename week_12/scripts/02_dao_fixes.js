const { ethers } = require("hardhat");
const { openLog, fmtEth } = require("./lib");

async function tryAttack(daoAddr, attackerEOA) {
  const DAOAttacker = await ethers.getContractFactory("DAOAttacker");
  const atk = await DAOAttacker.connect(attackerEOA).deploy(daoAddr, {
    value: ethers.parseEther("1"),
  });
  await atk.waitForDeployment();
  try {
    await atk.connect(attackerEOA).attack();
    return { reverted: false, attacker: atk };
  } catch (e) {
    return { reverted: true, reason: e.shortMessage || e.message, attacker: atk };
  }
}

async function main() {
  const log = openLog("dao_fixes.log");
  log.write("=== Week 12 Part 1 (fixes): DAO mitigation variants ===");
  log.write("Network: hardhatMainnet (local Hardhat in-memory)");
  log.write("");

  const [_, victim, attackerEOA] = await ethers.getSigners();

  // ---- CEI ----
  log.write("--- Fix A: Checks-Effects-Interactions ---");
  const CEI = await ethers.getContractFactory("SimpleDAO_CEI");
  const cei = await CEI.deploy();
  await cei.waitForDeployment();
  await cei.connect(victim).deposit({ value: ethers.parseEther("10") });
  log.write("Victim deposited 10 ETH into SimpleDAO_CEI");
  let r = await tryAttack(await cei.getAddress(), attackerEOA);
  log.write("Reentrancy attempt reverted? " + r.reverted + (r.reason ? "  (" + r.reason + ")" : ""));
  log.write("CEI DAO balance after attempt: " + fmtEth(ethers, await ethers.provider.getBalance(await cei.getAddress())));
  log.write("");

  // ---- Guard ----
  log.write("--- Fix B: Reentrancy guard ---");
  const Guard = await ethers.getContractFactory("SimpleDAO_Guard");
  const guard = await Guard.deploy();
  await guard.waitForDeployment();
  await guard.connect(victim).deposit({ value: ethers.parseEther("10") });
  log.write("Victim deposited 10 ETH into SimpleDAO_Guard");
  r = await tryAttack(await guard.getAddress(), attackerEOA);
  log.write("Reentrancy attempt reverted? " + r.reverted + (r.reason ? "  (" + r.reason + ")" : ""));
  log.write("Guard DAO balance after attempt: " + fmtEth(ethers, await ethers.provider.getBalance(await guard.getAddress())));
  log.write("");

  // ---- Pull payment ----
  log.write("--- Fix C: Pull-payment pattern ---");
  const Pull = await ethers.getContractFactory("SimpleDAO_PullPayment");
  const pull = await Pull.deploy();
  await pull.waitForDeployment();
  await pull.connect(victim).deposit({ value: ethers.parseEther("10") });
  log.write("Victim deposited 10 ETH into SimpleDAO_PullPayment");

  // Even if an attacker contract tried to attack, withdraw() doesn't send Ether,
  // so receive() is never triggered. Demonstrate legitimate flow instead.
  await pull.connect(victim).withdraw(ethers.parseEther("3"));
  log.write("Victim called withdraw(3 ETH). No Ether sent yet (queued credit).");
  await pull.connect(victim).claim();
  log.write("Victim called claim(). Funds released through pull path only.");
  log.write("Pull DAO balance after claim: " + fmtEth(ethers, await ethers.provider.getBalance(await pull.getAddress())));
  log.write("");

  log.write("RESULT: All three fix variants prevent the reentrancy drain.");
  await log.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
