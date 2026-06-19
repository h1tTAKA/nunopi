// 안쪽 스크롤 박스(줄별 설명/토큰 사전)가 wheel을 소화 못 할 때 — 스크롤이
// 불필요(내용이 박스보다 짧음)하거나 이미 경계(맨 위/맨 아래)일 때 — 가장 가까운
// [data-panel-scroll] 컨테이너(학습패널 aside)로 wheel을 넘겨 전체 패널이 스크롤되게 한다.
// 박스 중간이면 그대로 박스를 스크롤한다(내용 읽기 방해 안 함).
//
// React onWheel은 passive로 붙어 preventDefault가 막힐 수 있어, 네이티브
// addEventListener({ passive: false })로 직접 붙인다.
export function attachPanelWheelForward(el: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    const canScroll = el.scrollHeight - el.clientHeight > 1;
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= 1;
    // 박스가 해당 방향으로 스크롤 가능하면(중간) → 박스가 처리.
    if (canScroll && !(e.deltaY < 0 && atTop) && !(e.deltaY > 0 && atBottom)) return;
    const panel = el.closest<HTMLElement>("[data-panel-scroll]");
    if (!panel) return;
    panel.scrollTop += e.deltaY;
    e.preventDefault();
  };
  el.addEventListener("wheel", onWheel, { passive: false });
  return () => el.removeEventListener("wheel", onWheel);
}
