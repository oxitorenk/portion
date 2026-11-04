<script lang="ts">
  let { name }: { name: 'search' | 'plus' | 'back' } = $props();
</script>

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'search'}<circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
  {:else if name === 'plus'}<path d="M12 5v14M5 12h14" />
  {:else}<path d="m14 5-7 7 7 7M7 12h14" />{/if}
</svg>
