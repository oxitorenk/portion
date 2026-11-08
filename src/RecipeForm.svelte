<script lang="ts">
  import { tick, untrack } from 'svelte';
  import SwipeRow from './SwipeRow.svelte';
  import Icon from './Icon.svelte';
  import { sortable } from './sortable';
  import { keepFieldVisible } from './keepFieldVisible';
  import { createId, saveRecipe, toDraft, ValidationError, type Draft, type FieldErrors, type Recipe } from './recipes';
  let { recipe, onstate, onsaved }: {
    recipe?: Recipe; onstate: (dirty: boolean, busy: boolean) => void; onsaved: (recipe: Recipe) => void;
  } = $props();
  const initial = untrack(() => recipe);
  let draft = $state<Draft>(initial ? toDraft(initial) : { name: '', calories: '', ingredients: [], steps: [] });
  let recipeId = $state(initial?.id);
  let editing = $state<Record<string, boolean>>({});
  const originals = new Map<string, Draft['ingredients'][number] | Draft['steps'][number] | undefined>();
  let baseline = $state(JSON.stringify(draft));
  let busy = $state(false);
  let errors = $state<FieldErrors>({});
  let message = $state('');
  let failure = $state('');
  const dirty = $derived(JSON.stringify(draft) !== baseline);
  const sortingDisabled = $derived(busy || draft.ingredients.some((row) => editing[row.id]) || draft.steps.some((row) => editing[row.id]));
  $effect(() => onstate(dirty, busy));

  function beginEdit(id: string, kind: 'ingredient' | 'step', added = false) {
    if (editing[id]) return;
    const rows = kind === 'ingredient' ? draft.ingredients : draft.steps;
    originals.set(id, added ? undefined : { ...rows.find((row) => row.id === id)! });
    editing[id] = true;
  }

  async function cancelEditor(id: string, kind: 'ingredient' | 'step') {
    const original = originals.get(id);
    if (original) {
      const rows = kind === 'ingredient' ? draft.ingredients : draft.steps;
      Object.assign(rows.find((row) => row.id === id)!, original);
    } else if (kind === 'ingredient') draft.ingredients = draft.ingredients.filter((row) => row.id !== id);
    else draft.steps = draft.steps.filter((row) => row.id !== id);
    errors = Object.fromEntries(Object.entries(errors).filter(([key]) => !key.includes(id)));
    originals.delete(id);
    await closeEditor(id, kind);
    if (!original) document.getElementById(kind === 'ingredient' ? 'ingredients' : 'steps')?.focus();
  }

  async function closeEditor(id: string, kind: 'ingredient' | 'step') {
    editing[id] = false;
    originals.delete(id);
    await tick();
    document.getElementById(`${kind}-row-${id}`)?.querySelector<HTMLElement>('.row-front')?.focus();
  }

  async function acceptEditor(id: string, kind: 'ingredient' | 'step') {
    const field = kind === 'ingredient' ? `ingredient-${id}-name` : `step-${id}`;
    const value = kind === 'ingredient'
      ? draft.ingredients.find((row) => row.id === id)!.name
      : draft.steps.find((row) => row.id === id)!.text;
    if (!value.trim()) {
      errors[field] = kind === 'ingredient' ? 'Malzeme adını girin.' : 'Hazırlama adımını yazın.';
      await tick();
      document.getElementById(field)?.focus();
      return;
    }
    delete errors[field];
    await closeEditor(id, kind);
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !dirty) return;
    busy = true; message = ''; failure = ''; errors = {};
    let saved: Recipe | undefined;
    try {
      saved = await saveRecipe($state.snapshot(draft), recipeId);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors = error.fields;
        for (const [kind, rows] of [['ingredient', draft.ingredients], ['step', draft.steps]] as const) {
          for (const row of rows) {
            if (Object.keys(errors).some((key) => key.includes(row.id))) beginEdit(row.id, kind);
          }
        }
      }
      else failure = 'Tarif kaydedilemedi. Bilgileriniz formda korunuyor. Lütfen tekrar deneyin.';
    } finally {
      busy = false;
    }
    if (saved) {
      recipeId = saved.id;
      baseline = JSON.stringify(draft);
      for (const row of [...draft.ingredients, ...draft.steps]) {
        if (editing[row.id]) originals.set(row.id, { ...row });
      }
      message = 'Tarif kaydedildi';
      onsaved(saved);
    }
    await tick();
    const keys = Object.keys(errors);
    if (keys.length) document.getElementById(keys[0])?.focus();
  }
</script>

{#snippet error(id: string)}
  {#if errors[id]}<p id={`${id}-error`} class="error" role="alert">{errors[id]}</p>{/if}
{/snippet}

<h1>{recipeId ? 'Tarifi düzenle' : 'Yeni tarif'}</h1>
<form use:keepFieldVisible onsubmit={save} novalidate oninput={() => { message = ''; }}>
  <fieldset disabled={busy}>
    <div class="field">
      <label for="name">Tarif adı</label>
      <input id="name" required bind:value={draft.name} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />
      {@render error('name')}
    </div>
    <div class="field">
      <label for="calories">Kalori</label>
      <input id="calories" required inputmode="decimal" bind:value={draft.calories} aria-invalid={!!errors.calories} aria-describedby={errors.calories ? 'calories-error' : undefined} />
      {@render error('calories')}
    </div>
    <section class="recipe-section" aria-labelledby="ingredients-title">
      <h2 id="ingredients-title">Malzemeler</h2>
      <div class="form-list">
      <div class:sorting-disabled={sortingDisabled} use:sortable={{ disabled: sortingDisabled, onchange: (ids) => { draft.ingredients = ids.map((id) => draft.ingredients.find((row) => row.id === id)!); } }}>
      {#each draft.ingredients as row (row.id)}
        <div class="sortable-row" id={`ingredient-row-${row.id}`} data-id={row.id}>
        {#if !editing[row.id]}
          <SwipeRow label={row.name || 'Malzeme'} disabled={busy} onedit={async () => { beginEdit(row.id, 'ingredient'); await tick(); document.getElementById(`ingredient-${row.id}-name`)?.focus(); }} ondelete={() => { draft.ingredients = draft.ingredients.filter((item) => item.id !== row.id); errors = {}; document.getElementById('ingredients')?.focus(); }}>
            <span>{row.name || 'Malzeme adı girilmedi'}</span>
            {#if row.amount}<span class="muted">{row.amount} {row.unit}</span>{/if}
          </SwipeRow>
        {:else}
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
                <option value="">Seçin</option><option value="g">g</option><option value="ml">ml</option><option value="adet">adet</option><option value="çay kaşığı">çay kaşığı</option><option value="yemek kaşığı">yemek kaşığı</option><option value="tatlı kaşığı">tatlı kaşığı</option>
              </select>
              {@render error(`ingredient-${row.id}-unit`)}
            </div>
          </div>
          <div class="actions row-editor-actions">
            <button type="button" onclick={() => cancelEditor(row.id, 'ingredient')}>İptal</button>
            <button class="primary" type="button" onclick={() => acceptEditor(row.id, 'ingredient')}>Tamam</button>
          </div>
        </div>
        {/if}
        </div>
      {/each}
      </div>
      {#if !draft.ingredients.some((row) => editing[row.id])}
      <button class="add-row" id="ingredients" type="button" aria-describedby={errors.ingredients ? 'ingredients-error' : undefined} onclick={async () => {
        const id = createId(); draft.ingredients.push({ id, name: '', amount: '', unit: '' }); beginEdit(id, 'ingredient', true);
        await tick(); document.getElementById(`ingredient-${id}-name`)?.focus();
      }}><Icon name="plus" />Malzeme ekle</button>
      {/if}
      </div>
      {@render error('ingredients')}
    </section>
    <section class="recipe-section" aria-labelledby="steps-title">
      <h2 id="steps-title">Hazırlama adımları</h2>
      <div class="form-list">
      <div class:sorting-disabled={sortingDisabled} use:sortable={{ disabled: sortingDisabled, onchange: (ids) => { draft.steps = ids.map((id) => draft.steps.find((row) => row.id === id)!); } }}>
      {#each draft.steps as row, index (row.id)}
        <div class="sortable-row" id={`step-row-${row.id}`} data-id={row.id}>
        {#if !editing[row.id]}
          <SwipeRow label={`${index + 1}. adım`} disabled={busy} onedit={async () => { beginEdit(row.id, 'step'); await tick(); document.getElementById(`step-${row.id}`)?.focus(); }} ondelete={() => { draft.steps = draft.steps.filter((item) => item.id !== row.id); errors = {}; document.getElementById('steps')?.focus(); }}>
            <span>{index + 1}. {row.text || 'Hazırlama adımı girilmedi'}</span>
          </SwipeRow>
        {:else}
        <div class="field row-editor">
          <label for={`step-${row.id}`}>{index + 1}. adım</label>
          <textarea id={`step-${row.id}`} rows="3" required bind:value={row.text} aria-invalid={!!errors[`step-${row.id}`]} aria-describedby={errors[`step-${row.id}`] ? `step-${row.id}-error` : undefined}></textarea>
          {@render error(`step-${row.id}`)}
          <div class="actions row-editor-actions">
            <button type="button" onclick={() => cancelEditor(row.id, 'step')}>İptal</button>
            <button class="primary" type="button" onclick={() => acceptEditor(row.id, 'step')}>Tamam</button>
          </div>
        </div>
        {/if}
        </div>
      {/each}
      </div>
      {#if !draft.steps.some((row) => editing[row.id])}
      <button class="add-row" id="steps" type="button" aria-describedby={errors.steps ? 'steps-error' : undefined} onclick={async () => {
        const id = createId(); draft.steps.push({ id, text: '' }); beginEdit(id, 'step', true);
        await tick(); document.getElementById(`step-${id}`)?.focus();
      }}><Icon name="plus" />Adım ekle</button>
      {/if}
      </div>
      {@render error('steps')}
    </section>
  </fieldset>
  <div class="save-area">
    <p class="sr-only" role="status">{!dirty ? message : ''}</p>
    {#if failure}<p class="error" role="alert">{failure}</p>{/if}
    <button class="primary" type="submit" disabled={busy || !dirty}>
      {#if busy}Kaydediliyor…{:else if message && !dirty}<Icon name="check" />Kaydedildi{:else}Kaydet{/if}
    </button>
  </div>
</form>
