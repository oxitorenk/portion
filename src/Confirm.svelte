<script lang="ts">
  import { onMount } from 'svelte';
  let { title, message, cancel, confirm, onclose }: {
    title: string; message: string; cancel: string; confirm: string; onclose: (confirmed: boolean) => void;
  } = $props();
  let dialog: HTMLDialogElement;
  let cancelButton: HTMLButtonElement;
  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    cancelButton.focus();
    return () => { dialog.close(); previous?.focus(); };
  });
</script>

<dialog bind:this={dialog} aria-labelledby="confirm-title" aria-describedby="confirm-message" oncancel={(event) => { event.preventDefault(); onclose(false); }}>
  <h2 id="confirm-title">{title}</h2>
  <p id="confirm-message">{message}</p>
  <div class="actions">
    <button bind:this={cancelButton} onclick={() => onclose(false)}>{cancel}</button>
    <button class="danger" onclick={() => onclose(true)}>{confirm}</button>
  </div>
</dialog>
