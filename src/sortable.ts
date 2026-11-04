import Sortable from 'sortablejs';

export function sortable(node: HTMLElement, options: { disabled: boolean; onchange: (ids: string[]) => void }) {
  let originalNext: ChildNode | null = null;
  const sortable = Sortable.create(node, {
    animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160,
    delay: 350,
    delayOnTouchOnly: false,
    touchStartThreshold: 8,
    fallbackTolerance: 8,
    forceFallback: true,
    fallbackOnBody: true,
    draggable: '.sortable-row',
    handle: '.row-front',
    filter: 'input, textarea, select, .row-editor, .swipe-actions',
    preventOnFilter: false,
    disabled: options.disabled,
    onChoose(event) { originalNext = event.item.nextSibling; },
    onEnd(event) {
      const order = sortable.toArray();
      // Restore the exact DOM position, including Svelte's text/comment boundaries.
      node.insertBefore(event.item, originalNext);
      originalNext = null;
      if (event.oldDraggableIndex === undefined || event.newDraggableIndex === undefined || event.oldDraggableIndex === event.newDraggableIndex) return;
      if (!options.disabled) options.onchange(order);
    },
  });
  return {
    update(next: typeof options) { options = next; sortable.option('disabled', next.disabled); },
    destroy() { sortable.destroy(); },
  };
}
