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
