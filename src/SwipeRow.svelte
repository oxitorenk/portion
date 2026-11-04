<script module lang="ts">
  let closeActiveRow: (() => void) | undefined;
</script>

<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  let { children, label, onedit, ondelete, onopen, disabled = false }: {
    children: Snippet; label: string; onedit: () => void; ondelete: () => void; onopen?: () => void; disabled?: boolean;
  } = $props();
  let offset = $state(0);
  let moving = $state(false);
  let startX = 0;
  let startY = 0;
  let initial = 0;
  let tracking = false;
  let suppressClick = false;
  let host: HTMLDivElement;

  function closeRow() {
    offset = 0; moving = false; tracking = false;
    if (closeActiveRow === closeRow) closeActiveRow = undefined;
  }

  onDestroy(() => { if (closeActiveRow === closeRow) closeActiveRow = undefined; });

  function start(event: PointerEvent) {
    if (disabled || event.button !== 0 || !event.isPrimary || event.clientX < 24 ||
        (event.target as Element).closest('.swipe-actions')) return;
    startX = event.clientX; startY = event.clientY; initial = offset;
    tracking = true; moving = false; suppressClick = false;
  }
  function move(event: PointerEvent) {
    if (!tracking) return;
    if (host.closest('.sortable-chosen')) { tracking = false; suppressClick = true; return; }
    const x = event.clientX - startX;
    const y = event.clientY - startY;
    if (!moving) {
      if (Math.abs(y) > 8 && Math.abs(y) >= Math.abs(x)) { tracking = false; return; }
      if (Math.abs(x) < 8 || Math.abs(x) <= Math.abs(y) * 1.2) return;
      if (closeActiveRow !== closeRow) closeActiveRow?.();
      closeActiveRow = closeRow;
      moving = true; suppressClick = true;
      host.setPointerCapture(event.pointerId);
    }
    offset = Math.max(-176, Math.min(0, initial + x));
    event.preventDefault();
  }
  function finish(event: PointerEvent, cancelled = false) {
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    if (tracking || moving) offset = !cancelled && offset < -64 ? -176 : 0;
    tracking = false; moving = false;
    if (!offset && closeActiveRow === closeRow) closeActiveRow = undefined;
  }
</script>

<div bind:this={host} class="swipe-row" class:moving role="group" aria-label={label} onpointerdown={start} onpointermove={move} onpointerup={(event) => finish(event)} onpointercancel={(event) => finish(event, true)}>
  <div class="swipe-actions" style:transform={`translateX(${176 + offset}px)`} inert={offset !== -176 || moving}>
    <button type="button" disabled={disabled} onclick={() => { closeRow(); onedit(); }}>Düzenle</button>
    <button type="button" class="danger" disabled={disabled} onclick={ondelete}>Sil</button>
  </div>
  {#if onopen}
    <button class="row-front recipe-card" type="button" disabled={disabled} style:transform={`translateX(${offset}px)`} onclick={(event) => {
      if (suppressClick || host.closest('.sortable-chosen')) { event.preventDefault(); return; }
      if (offset) { closeRow(); return; } onopen?.();
    }}>{@render children()}</button>
  {:else}
    <div class="row-front form-row" tabindex="-1" style:transform={`translateX(${offset}px)`}>{@render children()}</div>
  {/if}
</div>
