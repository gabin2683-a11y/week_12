# Week 12 DAO / Parity Smart Contract Security Lab

**Local Hardhat simulation only.** 이 폴더는 Week 12 smart-contract security 실습을 위한 offline education package입니다. Live network, private key, RPC URL, faucet, wallet, real funds를 사용하지 않습니다.

## 1. Assignment objective

이 실습의 목표는 역사적으로 중요한 smart-contract failure mode 3가지를 controlled local environment에서 재현하고, 각 문제의 mitigation 또는 final state를 확인하는 것입니다.

- **DAO Reentrancy** — 잘못된 withdrawal order 때문에 DAO가 drain되고, fixed variants가 reentrant path를 차단하는지 확인합니다.
- **Parity #1: Unauthorized Initialization** — 초기화되지 않은 proxy wallet이 delegatecall을 통해 takeover될 수 있음을 확인하고, constructor initialization으로 방어합니다.
- **Parity #2: Library Self-Destruct** — shared library가 제거되면 해당 library를 바라보는 wallet funds가 stolen이 아니라 **frozen** 상태가 됨을 확인합니다.

핵심 요약: 이 과제는 실제 공격을 실행하는 프로젝트가 아니라, 취약점 원리와 방어 패턴을 이해하기 위한 **local-only security lab**입니다.

## 2. Safety boundary

- Local Hardhat simulation only (`--network hardhat`).
- No live network, no private key, no RPC URL.
- Vulnerable contracts는 교육용으로 의도적으로 unsafe하게 작성되어 있으며, 반드시 이 controlled lab 안에서만 다뤄야 합니다.
- Scripts는 `logs/`에 evidence를 남기기 위한 것이며, live deployment scripts가 아닙니다.
- **Parity #2 핵심**: 이 재현은 attacker가 wallet balance를 훔치는 것이 아니라, freeze / loss of access 상태를 보여줍니다.

## 3. Quick start

```bash
cd week_12
npm ci
npm test
```

Prerequisite: Node.js (>=18)와 npm. `package-lock.json`이 포함되어 있으므로 clean checkout에서는 `npm ci`를 권장합니다. 복사된 폴더에서 `npm ci`가 실패하면 fallback으로 `npm install`을 사용할 수 있습니다.

`npm test`가 이 과제의 main verification gate입니다. 내부적으로 compile 후 전체 simulation을 실행합니다.

```bash
npm run compile
npm run simulate:dao
npm run simulate:dao-fixes
npm run simulate:parity1
npm run simulate:parity2
```

정상 실행되면 아래 evidence logs가 생성/덮어쓰기됩니다.

- `logs/dao_attack.log`
- `logs/dao_fixes.log`
- `logs/parity1_attack.log`
- `logs/parity2_freeze.log`

## 4. Repository structure

```
week_12/
  contracts/
    dao/
      SimpleDAO.sol
      DAOAttacker.sol
      SimpleDAO_CEI.sol
      SimpleDAO_Guard.sol
      SimpleDAO_PullPayment.sol
    parity1/
      WalletLibraryVulnerable.sol
      WalletVulnerable.sol
      WalletFixed.sol
    parity2/
      SharedWalletLibraryVulnerable.sol
      SharedWallet.sol
      SharedWalletLibraryFixed.sol
  scripts/
    01_dao_attack.js
    02_dao_fixes.js
    03_parity1_attack.js
    04_parity2_freeze.js
    lib.js
  logs/
    dao_attack.log
    dao_fixes.log
    parity1_attack.log
    parity2_freeze.log
  diagrams/
    delegatecall_storage_collision.md
  screenshots/
    README.md
    (01..05 PNG files added after running npm test)
  student_ai_prompt_week12.md
  hardhat.config.js
  package.json
  package-lock.json
  README.md
```

## 5. Assignment-to-file mapping

| Part | What is demonstrated | Core contracts | Script | Evidence |
|------|----------------------|----------------|--------|----------|
| DAO Reentrancy | External call before balance update가 recursive withdrawal을 허용하고, CEI / guard / pull-payment가 이를 막습니다. | `contracts/dao/*` | `scripts/01_dao_attack.js`, `scripts/02_dao_fixes.js` | `logs/dao_attack.log`, `logs/dao_fixes.log` |
| Parity #1 | Proxy fallback delegatecall이 uninitialized proxy storage에 attacker owner를 기록합니다. | `contracts/parity1/*` | `scripts/03_parity1_attack.js` | `logs/parity1_attack.log` |
| Parity #2 | Shared library takeover와 selfdestruct가 delegated code를 제거해 proxy wallets를 freeze합니다. | `contracts/parity2/*` | `scripts/04_parity2_freeze.js` | `logs/parity2_freeze.log` |

## 6. Expected results

### 6.1 DAO Reentrancy

Expected vulnerable flow:

1. Victim이 `SimpleDAO`에 10 ETH를 deposit합니다.
2. Attacker가 1 ETH를 seed합니다.
3. `SimpleDAO`가 recorded balance를 줄이기 전에 `DAOAttacker.receive()`가 `withdraw()`로 re-enter합니다.
4. DAO balance는 0 ETH가 되고, attacker contract balance는 11 ETH가 됩니다.

Vulnerable ordering:

```solidity
(bool ok, ) = payable(msg.sender).call{value: amount}("");
require(ok, "send failed");
balances[msg.sender] -= amount;   // BUG: too late
```

Fix coverage:

- `SimpleDAO_CEI.sol`은 external call 전에 balance를 먼저 줄입니다 (Checks-Effects-Interactions).
- `SimpleDAO_Guard.sol`은 reentrancy guard로 recursive withdraw를 차단합니다.
- `SimpleDAO_PullPayment.sol`은 withdrawal을 queue에 넣어 첫 withdraw 중에 Ether를 push하지 않게 합니다.

### 6.2 Parity #1: Unauthorized Initialization

Expected vulnerable flow:

1. Vulnerable wallet library 1개가 deploy됩니다.
2. Proxy wallets 3개가 같은 library로 delegate합니다.
3. Wallet 1은 legitimate owner가 initialize하여 정상 owner control을 보입니다.
4. Wallet 2와 Wallet 3은 uninitialized 상태로 남습니다.
5. Attacker가 각 uninitialized proxy fallback을 통해 `initWallet([attacker], 1)`을 호출합니다.
6. delegatecall이 각 proxy storage에 attacker ownership을 기록합니다.
7. Attacker가 `execute()`를 호출해 Wallet 2와 Wallet 3을 drain합니다.

Expected fixed flow:

- `WalletFixed`는 constructor에서 ownership을 initialize합니다.
- `initWallet()` 재호출은 already initialized로 revert됩니다.
- Attacker의 `execute()`는 owner only로 revert됩니다.

### 6.3 Parity #2: Library Self-Destruct

Expected vulnerable flow:

1. Vulnerable shared library 1개가 deploy됩니다.
2. Funded `SharedWallet` proxies 3개가 legitimate owner로 initialize되고 같은 shared library를 가리킵니다.
3. Library contract 자체가 직접 initialize될 수 있습니다.
4. Attacker가 library own storage의 owner가 됩니다.
5. Attacker가 `killLibrary()`를 호출합니다.
6. 각 proxy는 여전히 같은 library address를 가리키지만, 그 address의 code가 사라집니다.
7. Owner의 `execute()` 호출은 delegatecall이 빈 코드를 향하므로 funds가 움직이지 않고, wallet balances는 제자리에 남습니다.

**Important: Parity #2 freezes funds; it does not transfer wallet funds to the attacker.** Attacker EOA balance는 gas만 소비될 뿐입니다.

Expected fixed flow:

- `SharedWalletLibraryFixed`는 direct library-instance initialization을 비활성화합니다 (`address(this) != LIBRARY_SELF` 체크).
- `killLibrary()` / `selfdestruct` entrypoint를 아예 제공하지 않습니다.
- Fixed library를 사용하는 wallet은 legitimate owner가 계속 사용할 수 있습니다.

## 7. Why Hardhat uses Merge / Paris here

`hardhat.config.js`는 아래 설정을 사용합니다.

- Solidity EVM version: `paris`
- Hardhat network hardfork: `merge`

이 설정은 의도된 것입니다. Modern Cancun / Prague semantics에서는 SELFDESTRUCT behavior가 바뀌어 같은 트랜잭션에서 code가 즉시 사라지지 않습니다. Parity #2의 historical replay에서 shared-library code가 사라지고 proxy wallets가 freeze되는 모습을 보여주려면 **pre-Cancun behavior**가 필요합니다.

## 8. Verification checklist

Reviewer 또는 학생은 `week_12/`에서 아래를 실행합니다.

```bash
npm test
ls logs
tail -n 8 logs/dao_attack.log
tail -n 8 logs/dao_fixes.log
tail -n 8 logs/parity1_attack.log
tail -n 8 logs/parity2_freeze.log
```

Pass criteria:

- [x] Compile succeeds.
- [x] DAO attack log가 vulnerable DAO drained to 0 ETH를 보여줍니다.
- [x] DAO fixes log가 CEI / guard reverts와 pull-payment safe path를 보여줍니다.
- [x] Parity #1 log가 uninitialized wallets drained와 fixed wallet protected를 보여줍니다.
- [x] Parity #2 log가 wallet balances가 stolen이 아니라 frozen in place임을 보여주고, fixed shared-library wallet이 계속 usable함을 보여줍니다.

## 9. Troubleshooting

- `npm ci`가 실패하면 먼저 Node.js / npm 설치 여부를 확인하고, 복사본 폴더라면 `npm install`을 시도합니다.
- 첫 compile은 solc 0.8.20 binary를 다운로드합니다. 인터넷 연결이 필요합니다.
- Parity #2에서 "왜 돈이 attacker에게 안 갔지?"라고 느껴진다면 정상입니다. 이 case의 핵심은 theft가 아니라 funds **freeze**입니다.

## 10. Warning

이 폴더의 vulnerable contracts와 scripts는 **교육 목적으로만** 작성되어 있습니다. 실제 네트워크에 배포하지 마십시오.
