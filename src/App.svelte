<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { registerSW } from 'virtual:pwa-register';
  import { scaleCalories } from './portion';
  import { createId, deleteRecipe, listRecipes, normalizeName, readRecipe, type Recipe } from './recipes';
  import SwipeRow from './SwipeRow.svelte';
  import Icon from './Icon.svelte';
  import Confirm from './Confirm.svelte';
  import Detail from './Detail.svelte';
  import RecipeForm from './RecipeForm.svelte';

  type Route = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'form'; id?: string };
  type Entry = { portion: string; index: number; route: Route };
  const session = createId();
  let route = $state<Route>({ kind: 'list' });
  let index = $state(0);
  let recipes = $state<Recipe[]>([]);
  let query = $state('');
  let loading = $state(true);
  let listError = $state(false);
  let current = $state<Recipe>();
  let panelLoading = $state(false);
  let panelError = $state(false);
  let dirty = $state(false);
  let busy = $state(false);
  let reducedMotion = $state(false);
  let pending = $state<(() => void) | undefined>();
  let pendingDelete = $state<Recipe>();
  let deleteError = $state(false);
  let updateAvailable = $state(false);
  let offlineError = $state(false);
  let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;
  let applyingUpdate = false;
  let reloadReady = false;
  let restoring = false;
  let loadVersion = 0;
  let listScroll = 0;
  const openers = new Map<number, HTMLElement>();
  const visible = $derived(recipes.filter((recipe) => recipe.normalizedName.includes(normalizeName(query))));

  async function loadList() {
    loading = true; listError = false;
    try { recipes = await listRecipes(); }
    catch { listError = true; }
    finally {
      loading = false;
      if (route.kind === 'list') { await tick(); window.scrollTo(0, listScroll); }
    }
  }

  async function loadPanel() {
    const version = ++loadVersion;
    current = undefined; panelError = false;
    if (route.kind === 'list' || (route.kind === 'form' && !route.id)) { panelLoading = false; return; }
    panelLoading = true;
    try {
      const recipe = await readRecipe(route.id!);
      if (version === loadVersion) current = recipe;
    } catch { if (version === loadVersion) panelError = true; }
    finally { if (version === loadVersion) panelLoading = false; }
  }

  async function show(next: Route) {
    dirty = false; busy = false; route = next;
    await loadPanel(); await tick();
    if (next.kind === 'list') {
      window.scrollTo(0, listScroll);
      const target = openers.get(0);
      if (target?.isConnected) target.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('.search-field input')?.focus({ preventScroll: true });
    }
  }

  function focusBack(node: HTMLButtonElement) {
    void tick().then(() => node.focus());
  }

  function deactivatePanel(event: Event) {
    const panel = event.target as HTMLElement;
    panel.inert = true;
    panel.setAttribute('aria-hidden', 'true');
  }

  function open(next: Route) {
    if (busy) return;
    if (route.kind === 'list') listScroll = window.scrollY;
    const active = document.activeElement as HTMLElement;
    openers.set(index, active.closest('.swipe-row')?.querySelector<HTMLElement>('.row-front') ?? active);
    index++;
    history.pushState({ portion: session, index, route: next } satisfies Entry, '');
    void show(next);
  }

  function back() {
    if (busy || pending) return;
    if (dirty) pending = () => { dirty = false; history.back(); };
    else history.back();
  }

  async function remove(recipe: Recipe) {
    busy = true; deleteError = false;
    try {
      await deleteRecipe(recipe.id);
      await loadList();
      if (route.kind !== 'list') history.go(-index);
      else document.querySelector<HTMLElement>('.search-field input')?.focus({ preventScroll: true });
    } catch { deleteError = true; }
    finally { busy = false; }
  }

  function registerWorker() {
    offlineError = false;
    applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh() { updateAvailable = true; },
      onNeedReload() {
        reloadReady = true;
        updateAvailable = true;
        if (applyingUpdate && route.kind === 'list' && !dirty) location.reload();
      },
      onRegisterError() { offlineError = true; },
    });
  }

  async function updateApp() {
    if (route.kind !== 'list' || dirty || busy || !applyUpdate) return;
    applyingUpdate = true; busy = true;
    try {
      if (reloadReady) location.reload();
      else await applyUpdate(true);
    } catch { applyingUpdate = false; busy = false; offlineError = true; }
  }

  onMount(() => {
    if ('serviceWorker' in navigator) registerWorker();
    history.replaceState({ portion: session, index: 0, route: { kind: 'list' } } satisfies Entry, '');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => { reducedMotion = motion.matches; };
    updateMotion(); motion.addEventListener('change', updateMotion);
    const pop = (event: PopStateEvent) => {
      const entry = event.state as Entry | null;
      if (restoring) { restoring = false; return; }
      if (!entry || entry.portion !== session) return;
      if (busy || dirty) {
        const delta = entry.index - index;
        if (!delta) return;
        restoring = true; history.go(-delta);
        if (dirty && !pending) pending = () => { dirty = false; history.go(delta); };
        return;
      }
      index = entry.index; void show(entry.route);
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (applyingUpdate || (!dirty && !busy)) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('beforeunload', unload);
    void loadList();
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('beforeunload', unload);
      motion.removeEventListener('change', updateMotion);
    };
  });

  $effect(() => {
    document.body.style.overflow = route.kind === 'list' ? '' : 'hidden';
    return () => { document.body.style.overflow = ''; };
  });
</script>

<main class="app-shell list-shell" inert={route.kind !== 'list'} aria-hidden={route.kind !== 'list'} aria-label="Tarifler">
  <div class="search-field">
    <Icon name="search" />
    <input type="search" aria-label="Tarif ara" placeholder="Tarif ara" bind:value={query} />
  </div>
  {#if updateAvailable}
    <div class="update-banner" role="status"><p>Yeni sürüm hazır.</p><button disabled={busy} onclick={updateApp}>Güncelle</button></div>
  {/if}
  {#if offlineError}
    <div class="update-banner"><p class="error" role="alert">Çevrimdışı kullanım hazırlanamadı. Lütfen tekrar deneyin.</p><button disabled={busy} onclick={registerWorker}>Tekrar dene</button></div>
  {/if}
  <div class="recipe-list" aria-busy={loading}>
    {#if loading}
      <span class="sr-only" role="status">Tarifler yükleniyor</span>
      <div class="skeleton" aria-hidden="true"></div><div class="skeleton" aria-hidden="true"></div><div class="skeleton" aria-hidden="true"></div>
    {:else if listError}
      <p class="error" role="alert">Tarifler yüklenemedi. Lütfen tekrar deneyin.</p><button onclick={loadList}>Tekrar dene</button>
    {:else if !recipes.length}<p class="empty">Henüz tarif eklemediniz</p>
    {:else if !visible.length}<p class="empty" role="status">Aramanıza uygun tarif bulunamadı</p>
    {:else}
      {#each visible as recipe (recipe.id)}
        <SwipeRow label={recipe.name} disabled={busy} onopen={() => open({ kind: 'detail', id: recipe.id })} onedit={() => open({ kind: 'form', id: recipe.id })} ondelete={() => { pendingDelete = recipe; }}>
          <span class="recipe-name">{recipe.name}</span><span class="muted">{scaleCalories(recipe.calories, 1)} kcal · 1 porsiyon</span>
        </SwipeRow>
      {/each}
    {/if}
  </div>
  {#if deleteError && route.kind === 'list'}<p class="error" role="alert">Tarif silinemedi. Lütfen tekrar deneyin.</p>{/if}
  <footer class="list-footer"><button class="primary" disabled={busy} onclick={() => open({ kind: 'form' })}><Icon name="plus" />Yeni tarif</button></footer>
</main>

{#if route.kind !== 'list'}
  {#key `${route.kind}-${index}`}
    <section class="panel" aria-label={route.kind === 'detail' ? 'Tarif detayı' : 'Tarif formu'} onoutrostart={deactivatePanel} in:fly={{ x: reducedMotion ? 0 : 24, duration: reducedMotion ? 0 : 220 }} out:fly={{ x: reducedMotion ? 0 : 24, duration: reducedMotion ? 0 : 180 }}>
      <div class="app-shell">
        <button class="panel-back" use:focusBack disabled={busy} onclick={back}><Icon name="back" />Geri</button>
        <div aria-busy={panelLoading}>
          {#if panelLoading}<div class="skeleton" aria-hidden="true"></div><span class="sr-only" role="status">Tarif yükleniyor</span>
          {:else if panelError}
            <p class="error" role="alert">Tarif yüklenemedi. Lütfen tekrar deneyin.</p><button onclick={loadPanel}>Tekrar dene</button>
          {:else if route.kind === 'detail' && current}
            <Detail recipe={current} onedit={() => open({ kind: 'form', id: current!.id })} ondelete={() => { if (!busy) pendingDelete = current; }} />
            {#if deleteError}<p class="error" role="alert">Tarif silinemedi. Lütfen tekrar deneyin.</p>{/if}
          {:else if route.kind === 'form'}
            <RecipeForm recipe={current} onstate={(changed, saving) => { dirty = changed; busy = saving; }} onsaved={(saved) => {
              route = { kind: 'form', id: saved.id };
              history.replaceState({ portion: session, index, route: $state.snapshot(route) } satisfies Entry, '');
              void loadList();
            }} />
          {/if}
        </div>
      </div>
    </section>
  {/key}
{/if}

{#if pendingDelete}
  <Confirm title="Tarifi sil" message={`“${pendingDelete.name}” tarifini silmek istiyor musunuz?`} cancel="Vazgeç" confirm="Sil" onclose={(confirmed) => { const recipe = pendingDelete; pendingDelete = undefined; if (confirmed && recipe) void remove(recipe); }} />
{/if}

{#if pending}
  <Confirm title="Kaydedilmemiş değişiklikler" message="Kaydedilmemiş değişiklikler var. Çıkarsanız değişiklikler kaybolacak." cancel="Düzenlemeye devam et" confirm="Değişiklikleri at" onclose={(confirmed) => { const action = pending; pending = undefined; if (confirmed) action?.(); }} />
{/if}
