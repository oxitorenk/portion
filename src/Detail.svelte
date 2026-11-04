<script lang="ts">
  import { parsePortions, scaleAmount, scaleCalories } from './portion';
  import type { Recipe } from './recipes';
  let { recipe, onedit, ondelete }: { recipe: Recipe; onedit: () => void; ondelete: () => void } = $props();
  let portions = $state('1');
  const parsed = $derived(parsePortions(portions));
</script>

<div class="actions detail-actions">
  <button onclick={onedit}>Düzenle</button>
  <button class="text-danger" onclick={ondelete}>Sil</button>
</div>
<h1>{recipe.name}</h1>
<p class="muted" role="status">{parsed ? `${scaleCalories(recipe.calories, parsed)} kcal` : 'Geçerli bir porsiyon girin.'}</p>
<section class="recipe-section">
  <div class="section-heading">
    <h2>Malzemeler</h2>
    <div class="portions">
      <label for="portions">Porsiyon</label>
      <input id="portions" inputmode="decimal" bind:value={portions} aria-invalid={!parsed} aria-describedby={!parsed ? 'portion-error' : undefined} />
    </div>
  </div>
  {#if !parsed}<p id="portion-error" class="error" role="alert">Sıfırdan büyük, en fazla iki ondalık basamaklı bir porsiyon girin.</p>{/if}
  <ul class="ingredients">
    {#each recipe.ingredients as row (row.id)}
      <li><span>{row.name}</span>{#if row.amount !== undefined}<span class="amount">{parsed ? scaleAmount(row.amount, parsed) : '—'} {row.unit}</span>{/if}</li>
    {/each}
  </ul>
</section>
<section class="recipe-section">
  <h2>Hazırlama</h2>
  <ol class="steps">{#each recipe.steps as row (row.id)}<li>{row.text}</li>{/each}</ol>
</section>
