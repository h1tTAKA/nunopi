// 안쪽 박스(줄별 설명/토큰 사전)가 내용이 짧아 스크롤이 아예 불필요할 때만,
// 그 위 wheel을 가장 가까운 [data-panel-scroll] 컨테이너(학습패널 aside)로 넘겨
// 전체 패널이 스크롤되게 한다.
//
// 스크롤 가능한 박스는 항상 자기가 처리한다(경계에서도 패널로 안 샌다 — 경계 누수
// 차단은 CSS overscroll-contain이 맡는다). 경계 포워딩을 하면 트랙패드 관성으로
// 박스 끝에 닿는 순간 패널이 튀는 것처럼 보여 제거했다.
//
// React onWheel은 passive로 붙어 preventDefault가 막힐 수 있어, 네이티브
// addEventListener({ passive: false })로 직접 붙인다.
export function attachPanelWheelForward(el: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    const canScroll = el.scrollHeight - el.clientHeight > 1;
    if (canScroll) return; // 스크롤 가능 → 박스가 처리(패널로 안 샘).
    const panel = el.closest<HTMLElement>("[data-panel-scroll]");
    if (!panel) return;
    panel.scrollTop += e.deltaY;
    e.preventDefault();
  };
  el.addEventListener("wheel", onWheel, { passive: false });
  return () => el.removeEventListener("wheel", onWheel);
}
