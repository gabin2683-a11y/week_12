# Delegatecall Storage Collision (Parity #1 / #2)

## Why delegatecall is dangerous here

`delegatecall` executes the **code** of the target (library) contract in the
**storage context** of the caller (proxy). Writes go into the proxy's storage,
not the library's.

If the proxy and the library declare their storage variables in the same
order, slot writes line up "naturally". An attacker who can trick the proxy
into delegating an `initWallet()` call can overwrite the proxy's owner slot.

## Slot layout used in this lab

Both `WalletLibraryVulnerable` and `WalletVulnerable` declare:

| Slot | Variable        | Type      |
|------|-----------------|-----------|
| 0    | owners          | address[] |
| 1    | required        | uint256   |
| 2    | initialized     | bool      |
| 3    | walletLibrary   | address   |  (proxy only)

For dynamic arrays in Solidity, slot 0 holds the array length and the
actual elements live at `keccak256(0)`, `keccak256(0)+1`, ...

## Attack flow (Parity #1)

```
   Attacker EOA
        |
        |  call proxy with calldata = initWallet([attacker], 1)
        v
+-------------------+         delegatecall          +--------------------------+
| WalletVulnerable  | ----------------------------> | WalletLibraryVulnerable  |
| (proxy storage)   | <-- writes land HERE --       | (code only)              |
+-------------------+                               +--------------------------+
        |
        |  owners[0] = attacker   (in proxy storage slot 0)
        |  required  = 1
        |  initialized = true
        v
   Attacker is now "owner" of the proxy.
```

## Attack flow (Parity #2)

Parity #2 reuses the same primitive but targets the **library itself**:

```
   Attacker EOA
        |
        |  call lib.initWallet([attacker], 1) DIRECTLY (not via proxy)
        v
+--------------------------+
| SharedWalletLibrary      |   <-- library's own storage now has
| (own storage)            |       attacker as owners[0]
+--------------------------+
        |
        |  attacker calls lib.killLibrary()
        v
   selfdestruct(attacker)
        |
        v
   Library code at libAddr is removed.
   Every proxy that points at libAddr now delegatecalls to empty code.
   -> proxy wallet funds are FROZEN, not stolen.
```

## Why funds are frozen, not stolen (Parity #2)

`selfdestruct` only sends the **library contract's own balance** to the
attacker. The library has no balance - the ETH lives in each proxy.
After the library is gone, the proxies still hold their ETH, but every
function call routes through `delegatecall` to an address with no code,
so no transfer ever executes. The ETH stays at the proxy address with
no way to move it.

## Mitigations

- Parity #1: initialize ownership in the proxy constructor and guard
  `initWallet()` with an `initialized` flag.
- Parity #2: refuse direct calls to `initWallet()` on the library
  instance (compare `address(this)` to a deploy-time constant), and
  remove every `selfdestruct` entrypoint.
