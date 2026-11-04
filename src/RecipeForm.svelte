<script lang="ts">
  import { tick, untrack } from 'svelte';
  import SwipeRow from './SwipeRow.svelte';
  import { sortable } from './sortable';
  import { createId, saveRecipe, toDraft, ValidationError, type Draft, type FieldErrors, type Recipe } from './recipes';
  let { recipe, onstate, onsaved }: {
    recipe?: Recipe; onstate: (dirty: boolean, busy: boolean) => void; onsaved: (recipe: Recipe) => void;
  } = $props();
  const initial = untrack(() => recipe);
  let draft = $state<Draft>(initial ? toDraft(initial) : { name: '', calories: '', ingredients: [], steps: [] });
  let recipeId = $state(initial?.id);
  let editing = $state<Record<string, boolean>>({});
  let baseline = $state(JSON.stringify(draft));
  let busy = $state(false);
  let errors = $state<FieldErrors>({});
  let message = $state('');
  let failure = $state('');
  let form: HTMLFormElement;
  const dirty = $derived(JSON.stringify(draft) !== baseline);
  $effect(() => onstate(dirty, busy));

  async function closeEditor(id: string, kind: 'ingredient' | 'step') {
    editing[id] = false;
    await tick();
    document.getElementById(`${kind}-row-${id}`)?.querySelector<HTMLElement>('.row-front')?.focus();
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true; message = ''; failure = ''; errors = {};
    let saved: Recipe | undefined;
    try {
      saved = await saveRecipe($state.snapshot(draft), recipeId);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors = error.fields;
        for (const row of [...draft.ingredients, ...draft.steps]) {
          if (Object.keys(errors).some((key) => key.includes(row.id))) editing[row.id] = true;
        }
      }
      else failure = 'Tarif kaydedilemedi. Bilgileriniz formda korunuyor. Lütfen tekrar deneyin.';
    } finally {
      busy = false;
    }
    if (saved) {
      recipeId = saved.id;
      baseline = JSON.stringify(draft);
      message = 'Tarif kaydedildi';
      onsaved(saved);
    }
    await tick();
    const keys = Object.keys(errors);
    if (keys.length > 1) form.querySelector<HTMLElement>('.error-summary')?.focus();
    else if (keys.length === 1) document.getElementById(keys[0])?.focus();
  }
</script>

{#snippet error(id: string)}
  {#if errors[id]}<p id={`${id}-error`} class="error" role="alert">{errors[id]}</p>{/if}
{/snippet}

<h1>{recipeId ? 'Tarifi düzenle' : 'Yeni tarif'}</h1>
<form bind:this={form} onsubmit={save} novalidate oninput={() => { message = ''; }}>
  {#if Object.keys(errors).length > 1}
    <div class="error-summary" role="alert" tabindex="-1" aria-labelledby="error-title">
      <h2 id="error-title">Alanları kontrol edin</h2>
      <ul>{#each Object.entries(errors) as [id, text] (id)}<li><a href={`#${id}`} onclick={(event) => { event.preventDefault(); document.getElementById(id)?.focus(); }}>{text}</a></li>{/each}</ul>
    </div>
  {/if}
  <fieldset disabled={busy}>
    <div class="field">
      <label for="name">Tarif adı</label>
      <input id="name" required bind:value={draft.name} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />
      {@render error('name')}
    </div>
    <div class="field">
      <label for="calories">Kalori (1 porsiyon, kcal)</label>
      <input id="calories" required inputmode="decimal" bind:value={draft.calories} aria-invalid={!!errors.calories} aria-describedby={errors.calories ? 'calories-error' : undefined} />
      {@render error('calories')}
    </div>
    <section class="recipe-section" aria-labelledby="ingredients-title">
      <h2 id="ingredients-title">Malzemeler</h2>
      <p class="muted gesture-help">Düzenlemek için sola kaydırın; sıralamak için basılı tutup sürükleyin.</p>
      <div use:sortable={{ disabled: busy, onchange: (ids) => { draft.ingredients = ids.map((id) => draft.ingredients.find((row) => row.id === id)!); } }}>
      {#each draft.ingredients as row (row.id)}
        <div class="sortable-row" id={`ingredient-row-${row.id}`} data-id={row.id}>
          <SwipeRow label={row.name || 'Malzeme'} disabled={busy} onedit={async () => { editing[row.id] = true; await tick(); document.getElementById(`ingredient-${row.id}-name`)?.focus(); }} ondelete={() => { draft.ingredients = draft.ingredients.filter((item) => item.id !== row.id); errors = {}; document.getElementById('ingredients')?.focus(); }}>
            <span>{row.name || 'Malzeme adı girilmedi'}</span>
            {#if row.amount}<span class="muted">{row.amount} {row.unit}</span>{/if}
          </SwipeRow>
        {#if editing[row.id]}
        <div class="row-editor">
          <div class="field">
            <label for={`ingredient-${row.id}-name`}>Malzeme adı</label>
            <input id={`ingredient-${row.id}-name`} required bind:value={row.name} aria-invalid={!!errors[`ingredient-${row.id}-name`]} aria-describedby={errors[`ingredient-${row.id}-name`] ? `ingredient-${row.id}-name-error` : undefined} />
            {@render error(`ingredient-${row.id}-name`)}
          </div>
          <div class="ingredient-values">
            <div class="field">
              <label for={`ingredient-${row.id}-amount`}>Miktar (isteğe bağlı)</label>
              <input id={`ingredient-${row.id}-amount`} inputmode="decimal" bind:value={row.amount} aria-invalid={!!errors[`ingredient-${row.id}-amount`]} aria-describedby={errors[`ingredient-${row.id}-amount`] ? `ingredient-${row.id}-amount-error` : undefined} />
              {@render error(`ingredient-${row.id}-amount`)}
            </div>
            <div class="field">
              <label for={`ingredient-${row.id}-unit`}>Birim</label>
              <select id={`ingredient-${row.id}-unit`} bind:value={row.unit} aria-invalid={!!errors[`ingredient-${row.id}-unit`]} aria-describedby={errors[`ingredient-${row.id}-unit`] ? `ingredient-${row.id}-unit-error` : undefined}>
                <option value="">Seçin</option><option value="g">g</option><option value="ml">ml</option><option value="adet">adet</option>
              </select>
              {@render error(`ingredient-${row.id}-unit`)}
            </div>
          </div>
          <button type="button" onclick={() => closeEditor(row.id, 'ingredient')}>Tamam</button>
        </div>
        {/if}
        </div>
      {/each}
      </div>
      <button id="ingredients" type="button" aria-describedby={errors.ingredients ? 'ingredients-error' : undefined} onclick={async () => {
        const id = createId(); draft.ingredients.push({ id, name: '', amount: '', unit: '' }); editing[id] = true;
        await tick(); document.getElementById(`ingredient-${id}-name`)?.focus();
      }}>Malzeme ekle</button>
      {@render error('ingredients')}
    </section>
    <section class="recipe-section" aria-labelledby="steps-title">
      <h2 id="steps-title">Hazırlama adımları</h2>
      <p class="muted gesture-help">Düzenlemek için sola kaydırın; sıralamak için basılı tutup sürükleyin.</p>
      <div use:sortable={{ disabled: busy, onchange: (ids) => { draft.steps = ids.map((id) => draft.steps.find((row) => row.id === id)!); } }}>
      {#each draft.steps as row, index (row.id)}
        <div class="sortable-row" id={`step-row-${row.id}`} data-id={row.id}>
          <SwipeRow label={`${index + 1}. adım`} disabled={busy} onedit={async () => { editing[row.id] = true; await tick(); document.getElementById(`step-${row.id}`)?.focus(); }} ondelete={() => { draft.steps = draft.steps.filter((item) => item.id !== row.id); errors = {}; document.getElementById('steps')?.focus(); }}>
            <span>{index + 1}. {row.text || 'Hazırlama adımı girilmedi'}</span>
          </SwipeRow>
        {#if editing[row.id]}
        <div class="field row-editor">
          <label for={`step-${row.id}`}>{index + 1}. adım</label>
          <textarea id={`step-${row.id}`} rows="3" required bind:value={row.text} aria-invalid={!!errors[`step-${row.id}`]} aria-describedby={errors[`step-${row.id}`] ? `step-${row.id}-error` : undefined}></textarea>
          {@render error(`step-${row.id}`)}
          <button type="button" onclick={() => closeEditor(row.id, 'step')}>Tamam</button>
        </div>
        {/if}
        </div>
      {/each}
      </div>
      <button id="steps" type="button" aria-describedby={errors.steps ? 'steps-error' : undefined} onclick={async () => {
        const id = createId(); draft.steps.push({ id, text: '' }); editing[id] = true;
        await tick(); document.getElementById(`step-${id}`)?.focus();
      }}>Adım ekle</button>
      {@render error('steps')}
    </section>
  </fieldset>
  <div class="save-area">
    <p role="status">{message}</p>
    {#if failure}<p class="error" role="alert">{failure}</p>{/if}
    <button class="primary" type="submit" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
  </div>
</form>
