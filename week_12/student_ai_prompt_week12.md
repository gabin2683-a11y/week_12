# student_ai_prompt_week12.md

> 본 파일은 보조 학습자료입니다. 핵심 executable submission evidence는 `logs/` 아래 텍스트 로그입니다.

## 이 실습으로 배워야 하는 것

1. **순서가 보안을 결정한다.**
   `withdraw()`에서 `call → state` 순서로 쓰면 reentrancy가 가능하고,
   `state → call` 순서로 쓰면 막힙니다. CEI (Checks-Effects-Interactions) 원칙.

2. **delegatecall은 코드가 아니라 storage가 위험하다.**
   library 코드가 proxy의 storage에 직접 쓰기 때문에, library에 있는
   `initWallet()` 같은 무방비 함수가 proxy의 owner slot을 덮어쓸 수 있습니다.
   (Parity #1)

3. **공유 의존성을 죽이면 자금이 stolen이 아니라 frozen이 된다.**
   `selfdestruct`로 라이브러리 코드가 사라지면, proxy는 같은 주소를
   delegatecall하지만 그 주소엔 코드가 없어서 함수 호출이 의미 없는 동작이
   됩니다. ETH는 proxy 안에 그대로 있지만 옮길 방법이 없습니다. (Parity #2)

## AI에게 물어볼 때 좋은 질문 예시

- "왜 Parity #2에서 attacker EOA의 잔액이 늘지 않았는지 단계별로 설명해줘."
- "Solidity 0.8.20의 underflow check를 끄지 않고도 DAO reentrancy를 재현할
  수 있는 다른 방법이 있을까?"
- "`selfdestruct`가 Cancun에서 어떻게 바뀌었고, 그게 이 실습 재현에 왜
  영향을 주는지 설명해줘."
- "Parity #1의 fix로 constructor initialization 대신 사용할 수 있는 다른
  방어 패턴(예: initializer modifier, OpenZeppelin's Initializable)을
  비교해줘."

## AI에게 물어보지 말아야 할 것

- 라이브 네트워크에서 reentrancy를 시도하는 방법.
- 실제 키나 RPC URL을 사용하는 deployment script.
- 위 contracts를 실제 자금이 있는 wallet에 적용하는 방법.

이 실습은 **local Hardhat lab 안에서만** 의미가 있습니다.

## Submission 점검 포인트

- `npm test`가 끝까지 통과하는가?
- `logs/` 아래 4개 파일이 모두 최신 timestamp인가?
- `logs/parity2_freeze.log` 안에 "frozen in place" 또는 동등한 표현이
  포함되어 있고, attacker balance가 wallet 자금만큼 증가하지 **않는다는**
  것이 명시되어 있는가?
- README의 safety boundary 섹션을 읽고 이해했는가?
