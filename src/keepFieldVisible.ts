export function visibilityScroll(top: number, bottom: number, visibleTop: number, visibleBottom: number): number {
  if (top < visibleTop) return top - visibleTop;
  if (bottom > visibleBottom) return Math.min(bottom - visibleBottom, top - visibleTop);
  return 0;
}

export function keepFieldVisible(node: HTMLFormElement) {
  const panel = node.closest<HTMLElement>('.panel');
  const viewport = window.visualViewport;
  let frame = 0;

  function update() {
    frame = 0;
    const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
    node.style.paddingBottom = `${inset}px`;
    const active = document.activeElement;
    if (!panel || !(active instanceof HTMLElement) || !node.contains(active) || !active.matches('input, textarea, select')) return;
    const panelRect = panel.getBoundingClientRect();
    const top = Math.max(panelRect.top, viewport?.offsetTop ?? 0) + 16;
    const bottom = Math.min(panelRect.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)) - 16;
    if (bottom <= top) return;
    const editor = active.closest('.row-editor')?.getBoundingClientRect();
    const field = active.closest('.field')?.getBoundingClientRect();
    const target = editor && editor.height <= bottom - top ? editor
      : field && field.height <= bottom - top ? field : active.getBoundingClientRect();
    panel.scrollTop += visibilityScroll(target.top, target.bottom, top, bottom);
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }

  node.addEventListener('focusin', schedule);
  viewport?.addEventListener('resize', schedule);
  window.addEventListener('resize', schedule);
  return {
    destroy() {
      cancelAnimationFrame(frame);
      node.removeEventListener('focusin', schedule);
      viewport?.removeEventListener('resize', schedule);
      window.removeEventListener('resize', schedule);
      node.style.removeProperty('padding-bottom');
    },
  };
}
