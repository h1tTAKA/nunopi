# Issue 928 학습 정리 — 테스트 알림 버튼 결과 토스트 + adhoc 서명 한계

## 핵심 요약
> "테스트 알림 보내기" 버튼이 눌러도 반응이 없어서, **결과를 화면 띠지(토스트)로 되돌려주게** 고친 작업. 그 과정에서 dev 빌드가 미서명(adhoc)이라 macOS가 알림을 조용히 버린다는 사실을 확인.

## 유저 관점에서 보면?
- 전에는: 버튼 눌러도 아무 반응 없음 → 작동하는지 안 하는지 알 수 없음.
- 이제는: 누르면 "전송됨"(초록) 또는 "실패 (사유)"(빨강) 또는 "데스크톱 아님" 안내가 뜸 → **어디까지 갔는지 눈으로 확인 가능.**

---

## 1. 큰 그림 (구조 + 이름 먼저)

### 비유
버튼이 편지(알림)를 우체통(notify IPC)에 넣기만 하고 끝냈다. 잘 갔는지 사장님은 알 수가 없었다. 이번엔 우체국이 주는 **접수증(반환값 `{ ok, reason }`)** 을 받아서, 사장님 책상에 "접수 완료" 또는 "반송: 사유 X" 쪽지(토스트)를 붙여준다.

### 부품과 역할
| 부품 | 역할 |
|---|---|
| `useToast()` | 화면 구석에 잠깐 뜨는 알림 띠지를 띄우는 공용 훅 |
| `sendTestNotif()` | 테스트 버튼 눌렀을 때 실행. notify 호출 + 결과 토스트 |
| `window.nunopiDesktop.notify()` | 데스크톱 알림 요청. `{ ok, reason }` 반환 |

### 새로 지은 이름들
| 이름 | 정체 |
|---|---|
| `sendTestNotif` | 테스트 알림 보내고 결과를 토스트로 보여주는 async 함수 |
| `nd` | `window.nunopiDesktop`을 짧게 담은 지역 변수(없으면 `undefined`) |
| i18n 키 `notifTestSent/Failed/NoDesktop` | "전송됨/실패/데스크톱없음" 3개국어 문구 |

---

## 2. 동작 ↔ 코드 (1대1)

**1) 테스트 알림 보내고 결과 토스트** — `SettingsDrawer.tsx`:
```ts
const toast = useToast();
const sendTestNotif = async () => {
  const nd = typeof window !== "undefined" ? window.nunopiDesktop : undefined;
  if (!nd?.notify) { toast(t("settings.notifTestNoDesktop"), "error"); return; }
  try {
    const r = await nd.notify({ title: t("settings.notifTestTitle"), body: t("settings.notifTestBody"), suppressWhileFocused: false });
    if (r?.ok) toast(t("settings.notifTestSent"), "success");
    else toast(t("settings.notifTestFailed") + (r?.reason ? ` (${r.reason})` : ""), "error");
  } catch { toast(t("settings.notifTestFailed"), "error"); }
};
```
🔍 **뜯어보기**
- `async () => {}` = 비동기 함수. 안에서 `await`로 결과 기다릴 수 있음.
- `typeof window !== "undefined"` = 서버 렌더링(SSR) 땐 `window`가 없어서 터지는 걸 막는 가드.
- `if (!nd?.notify)` = 데스크톱 API나 notify 함수가 없으면 → 안내 토스트 후 `return`(더 진행 안 함).
- `await nd.notify(...)` = 알림 요청 보내고 **접수증(`r`)이 올 때까지 기다림.**
- `suppressWhileFocused: false` = 테스트니까 창 보고 있어도 뜨게(억제 안 함).
- `r?.ok` = 접수증에 `ok:true`면 성공. `toast(문구, "success")` = 초록 띠지.
- `else` = 실패면 `r?.reason`이 있으면 괄호로 붙여서 빨강 띠지. `?.`로 reason 없어도 안전.
- `catch` = notify 호출 자체가 예외 던지면(드묾) 실패 토스트.
- `toast(message, variant)` 시그니처: variant는 `"success" | "error"`.

**2) 버튼에 연결**:
```tsx
<button onClick={() => void sendTestNotif()}>...</button>
```
🔍 **뜯어보기**
- `() => void sendTestNotif()` = 클릭 시 async 함수 실행. `void`로 반환 Promise를 명시적으로 버림(리액트 onClick은 Promise 반환을 원치 않음).

---

## 3. ⚠️ 핵심 함정 — adhoc 서명 알림 드롭

테스트해보니 **토스트는 "전송됨"인데 macOS 알림은 안 떴다.** 왜?

- `ok:true` = 우리 코드가 `Notification.show()`를 **정상 호출**했다는 뜻. 코드는 맞음.
- 그런데 dev `--dir` 빌드는 코드서명이 `Signature=adhoc`(임시 서명). 확인:
  ```
  $ codesign -dv Mustard.app
  CodeDirectory ... flags=0x20002(adhoc,linker-signed)
  Signature=adhoc
  ```
- **macOS는 adhoc/미서명 앱의 알림을 조용히 버린다.** 알림센터에 앱이 등록조차 안 됨. `Notification.show()`는 성공으로 리턴하지만 화면엔 안 뜸.
- 해결: **Developer ID로 정식 코드서명 + notarize한 배포용 dmg** 에서만 실제로 뜬다. (#684 계열 서명/패키징 갭 — 현재 보류.)

즉 dev 빌드로는 "알림이 실제로 뜨는지"는 검증 불가. 대신 **토스트로 `notify()` 호출 성공(ok:true)까지는 확인**했고, 그게 우리가 코드로 보장할 수 있는 전부다.

### 여기서 짚을 포인트
- **`ok:true` ≠ 화면에 뜸.** IPC 호출 성공과 OS의 실제 표시는 다른 층. 서명이 그 사이를 가른다.
- 유저가 **A안**(코드 유지, 서명 시 표시) 선택 → 코드 수정 없이 한계만 문서화.
- 관련: [[02_터미널벨과포커스억제_학습정리]] — 같은 notify IPC. 벨/완료 알림도 dev 빌드선 같은 이유로 화면 표시는 안 됨.
