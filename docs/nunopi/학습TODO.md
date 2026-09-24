# 학습 TODO — 되짚을 학습 포인트 목록

이슈별로 "나중에 더 깊이 팔 것" 체크리스트. 최신 이슈가 위.
(학습정리=정리본, 이건 복습/topdown 재료용 포인트 목록)

## #928 — 알림 설정 (설정 다양화 서브4)
- [ ] `subscribeSettings` + `useSyncExternalStore` 패턴 — 외부 스토어를 React에 안전히 잇는 표준 방법 파보기
- [ ] `useEffect(() => subscribeSettings(...), [])`의 **화살표 암묵 반환 = cleanup** 관용구. 왜 릭이 아닌지 확실히 이해
- [ ] state vs ref — 폴링 콜백 클로저가 옛 state를 붙잡는 문제(stale closure)와 ref 우회
- [ ] `suppressWhileFocused !== false` 같은 **기본값 보존형 비교**의 함정(`undefined` 처리)
- [ ] macOS 코드서명(adhoc vs Developer ID) + notarize가 Notification 표시에 미치는 영향. `codesign -dv` 읽는 법
- [ ] Electron IPC(`ipcMain.handle` / `window.x.invoke`)의 요청-응답 왕복과 `{ ok, reason }` 반환 규약
- [ ] 멱등 마이그레이션 패턴("새 값 없을 때만 옮기기")
