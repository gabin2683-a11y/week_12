# Week 12 — DAO / Parity Smart Contract Security Lab

블록체인 수업 Week 12 과제 제출물입니다.

## 1. 과제 개요

원본 과제 명세는 다음과 같습니다.

> Simulate the DAO Hack (2016) and the two Parity Wallet hacks (2017) in a local environment.
> Execute the attacks, document the vulnerabilities, and propose fixes.

이번 실습에서는 이더리움 역사에서 유명한 세 가지 smart contract 취약점을 로컬 환경에서 재현하고, 각각의 fix를 검증합니다.

| Part | 내용 | 핵심 메시지 |
|------|------|-------------|
| 1. DAO Reentrancy (2016) | 외부 호출 전에 상태가 업데이트되지 않아 재진입으로 drain | call 전에 state 갱신 (CEI) |
| 2. Parity #1 — Unauthorized Init (2017) | uninitialized proxy의 fallback delegatecall로 attacker가 owner가 됨 | constructor에서 초기화 |
| 3. Parity #2 — Library Self-Destruct (2017) | shared library가 selfdestruct되면 proxy wallet 자금이 freeze | selfdestruct 진입점 제거 |

특히 Part 3은 **공격자에게 자금이 옮겨가는 것이 아니라 영구히 frozen된다**는 점이 가장 중요한 학습 포인트입니다.

## 2. 안전 경계

- 모든 실행은 로컬 Hardhat in-memory network (`--network hardhat`)에서만 이루어집니다.
- 실제 네트워크에 배포하거나 private key를 사용하지 않습니다.
- vulnerable contract들은 의도적으로 안전하지 않게 작성된 교육용 코드입니다. **실전 배포 금지**.

## 3. 실행 방법

```bash
npm ci
npm test
```

`npm test`는 내부적으로 compile + 4개 시뮬레이션을 순서대로 실행합니다.

```bash
npm run compile
npm run simulate:dao          # Part 1 — DAO 공격
npm run simulate:dao-fixes    # Part 1 — DAO 방어 (CEI / Guard / Pull-payment)
npm run simulate:parity1      # Part 2 — Parity #1
npm run simulate:parity2      # Part 3 — Parity #2 (핵심 과제)
```

실행이 끝나면 `logs/` 아래 4개 로그가 생성/갱신됩니다.

## 4. 폴더 구조
week_12/
├── contracts/
│   ├── dao/                                  # Part 1
│   │   ├── SimpleDAO.sol                     # vulnerable
│   │   ├── DAOAttacker.sol                   # 재진입 공격 컨트랙트
│   │   ├── SimpleDAO_CEI.sol                 # fix A — Checks-Effects-Interactions
│   │   ├── SimpleDAO_Guard.sol               # fix B — reentrancy guard
│   │   └── SimpleDAO_PullPayment.sol         # fix C — pull-payment pattern
│   ├── parity1/                              # Part 2
│   │   ├── WalletLibraryVulnerable.sol
│   │   ├── WalletVulnerable.sol              # proxy
│   │   └── WalletFixed.sol                   # constructor init + 재초기화 차단
│   └── parity2/                              # Part 3
│       ├── SharedWalletLibraryVulnerable.sol # initWallet/killLibrary 무방비
│       ├── SharedWallet.sol                  # delegatecall proxy
│       └── SharedWalletLibraryFixed.sol      # 직접 호출 차단 + selfdestruct 없음
├── scripts/
│   ├── 01_dao_attack.js
│   ├── 02_dao_fixes.js
│   ├── 03_parity1_attack.js
│   ├── 04_parity2_freeze.js
│   └── lib.js                                # 로깅 유틸
├── logs/                                     # 실행 결과 텍스트 로그
├── diagrams/
│   └── delegatecall_storage_collision.md     # Parity #1/#2 storage collision 설명
├── screenshots/                              # 실행 화면 캡쳐 (PNG)
├── hardhat.config.js
├── package.json
└── README.md

## 5. 핵심 결과 (Part 3 — Parity #2)

원본 과제에서 요구한 7개 task가 `04_parity2_freeze.js` 안에 그대로 매핑되어 있고, `logs/parity2_freeze.log`에서 확인할 수 있습니다.

| 과제 Task | 스크립트 단계 | 결과 |
|----------|---------------|------|
| 1. walletLibrary와 3개 wallet 배포 (같은 라이브러리 가리킴) | Step 1–2 | ✅ |
| 2. 각 wallet을 initialize하고 fund | Step 3 | ✅ 각 5 ETH |
| 3. attacker가 library에 직접 `initWallet()` 호출해서 owner 됨 | Step 4 | ✅ owners[0] = attacker |
| 4. attacker가 library에 직접 `kill()` 호출 → selfdestruct | Step 5 | ✅ code size 1298 → 0 bytes |
| 5. wallet 함수 호출 시도 → delegatecall failure 확인 | Step 6 | ✅ 잔액 변화 없음 |
| 6. 자금이 frozen인 이유 설명 | Step 7 | ✅ attacker EOA는 gas만 소비 |
| 7. access control + selfdestruct 제거 fix | Fixed library variant | ✅ 직접 init 차단, kill 진입점 자체가 없음 |

실행 로그 발췌:

Step 5: Attacker calls killLibrary() directly on the library

Library code size BEFORE kill: 1298 bytes

Library code size AFTER  kill: 0 bytes

Step 6: Each legitimate owner attempts execute() on their wallet

Wallet 1 execute() tx status=1, delegatecall to empty library returned without moving funds

Wallet 1 balance: 4.0 ETH (unchanged, frozen)

...

Step 7: Confirm funds are FROZEN, not STOLEN

Attacker EOA balance change is only gas spent.

Each wallet still holds its ETH but can no longer move it.


## 6. 왜 자금이 frozen이고 stolen이 아닌가

`selfdestruct(payable(attacker))`는 **library contract 자신의 잔액만** attacker에게 보냅니다. 그런데 library는 잔액이 0입니다 — ETH는 각 proxy wallet 안에 있습니다. selfdestruct로 사라지는 것은 **library의 코드**입니다.

코드가 사라진 후에도 proxy wallet들은 여전히 같은 library 주소를 `walletLibrary` slot에 저장하고 있고, 모든 함수 호출은 그 주소로 `delegatecall`됩니다. 빈 주소로의 delegatecall은 EVM에서 **성공으로 처리되지만 아무 일도 일어나지 않습니다** (`status=1`이지만 잔액 변화 없음). 따라서:

- 자금은 proxy wallet 안에 그대로 있음 (도난 X)
- 하지만 어떤 함수로도 옮길 수 없음 (영구 동결)

이것이 2017년 11월 Parity multi-sig 사건에서 약 513,000 ETH가 영구히 잠긴 메커니즘입니다.

## 7. EVM 설정 관련

`hardhat.config.js`에서 EVM 버전을 `paris`, hardfork를 `merge`로 고정했습니다. Cancun 이후의 SELFDESTRUCT semantics에서는 같은 트랜잭션에서 코드가 즉시 사라지지 않기 때문에, Parity #2의 historical replay를 위해서는 **pre-Cancun 동작**이 필요합니다.

## 8. 검증 체크리스트

- [x] DAO 공격: 10 ETH DAO를 1 ETH seed로 drain (DAO → 0 ETH, attacker → 11 ETH)
- [x] DAO 방어 3종 (CEI / Guard / Pull-payment): 모두 reentrancy 차단
- [x] Parity #1: uninitialized proxy 2개 drain, fixed wallet은 보호됨
- [x] Parity #2: library 코드 1298 → 0 bytes, 3개 wallet 자금 frozen, attacker는 gas만 소비
- [x] Fixed shared library: 직접 init 차단, selfdestruct 진입점 없음, proxy 정상 동작

## 9. 경고

이 폴더의 vulnerable contracts와 attack scripts는 **교육 목적의 로컬 시뮬레이션 전용**입니다. 실제 네트워크에 배포하지 마십시오.
