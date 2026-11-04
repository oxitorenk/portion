<script lang="ts">
  import { parsePortions, scaleAmount, scaleCalories } from './portion';
  import type { Recipe } from './recipes';
  let { recipe }: { recipe: Recipe } = $props();
  let portions = $state('1');
  const parsed = $derived(parsePortions(portions));
</script>

<header class="recipe-heading">
  <h1>{recipe.name}</h1>
  <div class="recipe-meta">
    <p class="muted" role="status">{parsed ? `${scaleCalories(recipe.calories, parsed)} kcal` : 'Geçerli bir porsiyon girin.'}</p>
    <div class="portions">
      <label for="portions">Porsiyon</label>
      <input id="portions" inputmode="decimal" bind:value={portions} aria-invalid={!parsed} aria-describedby={!parsed ? 'portion-error' : undefined} />
    </div>
  </div>
</header>
  {#if !parsed}<p id="portion-error" class="error" role="alert">Sıfırdan büyük, en fazla iki ondalık basamaklı bir porsiyon girin.</p>{/if}
<section class="recipe-section">
  <h2>Malzemeler</h2>
  <ul class="ingredients">
    {#each recipe.ingredients as row (row.id)}
      <li><span>{row.name}</span>{#if row.amount !== undefined}<span class="amount">{parsed ? scaleAmount(row.amount, parsed) : '—'} {row.unit}</span>{/if}</li>
    {/each}
  </ul>
</section>
<section class="recipe-section">
  <h2>Hazırlama adımları</h2>
  <ol class="steps">{#each recipe.steps as row (row.id)}<li>{row.text}</li>{/each}</ol>
</section>
