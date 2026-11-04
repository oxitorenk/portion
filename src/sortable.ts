import Sortable from 'sortablejs';

export function sortable(node: HTMLElement, options: { disabled: boolean; onchange: (ids: string[]) => void }) {
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
    onEnd(event) {
      if (event.oldDraggableIndex === undefined || event.newDraggableIndex === undefined || event.oldDraggableIndex === event.newDraggableIndex) return;
      const order = sortable.toArray();
      const original = [...order];
      original.splice(event.oldDraggableIndex, 0, original.splice(event.newDraggableIndex, 1)[0]);
      sortable.sort(original);
      if (!options.disabled) options.onchange(order);
    },
  });
  return {
    update(next: typeof options) { options = next; sortable.option('disabled', next.disabled); },
    destroy() { sortable.destroy(); },
  };
}
