# Screenshots

이 폴더는 reviewer가 expected output을 빠르게 비교할 수 있도록 추가한 보조
evidence입니다. **Primary evidence는 `logs/` 아래의 text logs**입니다.

| 파일 | 내용 | Canonical log |
|------|------|---------------|
| 01-npm-test-dao-attack.png | `npm test` 시작과 vulnerable DAO reentrancy drain | `logs/dao_attack.log` |
| 02-dao-fixes-cei-guard.png | CEI / guard fix가 reentrant path 차단 | `logs/dao_fixes.log` |
| 03-dao-fixes-pull-payment.png | Pull-payment claim path | `logs/dao_fixes.log` |
| 04-parity1-unauthorized-initialization.png | Parity #1 takeover와 fixed wallet 보호 | `logs/parity1_attack.log` |
| 05-parity2-library-self-destruct.png | Parity #2 library kill 후 wallet freeze | `logs/parity2_freeze.log` |

스크린샷은 `npm test` 직후 터미널을 캡쳐해서 이 폴더에 같은 이름으로 저장하면
됩니다.
