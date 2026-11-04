import Dexie, { type EntityTable } from 'dexie';

export type Unit = 'g' | 'ml' | 'adet' | 'çay kaşığı' | 'yemek kaşığı' | 'tatlı kaşığı';
export type Ingredient = { id: string; name: string; amount?: number; unit?: Unit };
export type Step = { id: string; text: string };
export type Recipe = {
  id: string;
  name: string;
  normalizedName: string;
  calories: number;
  ingredients: Ingredient[];
  steps: Step[];
  createdAt: number;
  sortOrder?: number;
};
export type Draft = {
  name: string;
  calories: string;
  ingredients: { id: string; name: string; amount: string; unit: string }[];
  steps: Step[];
};
export type FieldErrors = Record<string, string>;

export class ValidationError extends Error {
  fields: FieldErrors;
  constructor(fields: FieldErrors) {
    super('Tarif alanlarını kontrol edin.');
    this.fields = fields;
  }
}

export function normalizeName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('tr-TR');
}

export function parseDecimal(value: string): number | undefined {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d+)?$/u.test(text)) return undefined;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : undefined;
}

export function validateDraft(draft: Draft) {
  const errors: FieldErrors = {};
  const name = draft.name.trim().replace(/\s+/gu, ' ');
  if (!name) errors.name = 'Tarif adını girin.';
  const calories = parseDecimal(draft.calories);
  if (calories === undefined || calories < 0) errors.calories = 'Sıfır veya üzeri geçerli bir kalori girin.';
  if (!draft.ingredients.length) errors.ingredients = 'En az bir malzeme ekleyin.';
  if (!draft.steps.length) errors.steps = 'En az bir hazırlama adımı ekleyin.';
  const ingredients: Ingredient[] = draft.ingredients.map((row) => {
    if (!row.name.trim()) errors[`ingredient-${row.id}-name`] = 'Malzeme adını girin.';
    const amount = row.amount.trim() ? parseDecimal(row.amount) : undefined;
    if (row.amount.trim() && (amount === undefined || amount <= 0)) {
      errors[`ingredient-${row.id}-amount`] = 'Sıfırdan büyük geçerli bir miktar girin.';
    }
    if (row.amount.trim() && !['g', 'ml', 'adet', 'çay kaşığı', 'yemek kaşığı', 'tatlı kaşığı'].includes(row.unit)) {
      errors[`ingredient-${row.id}-unit`] = 'Birimi seçin.';
    }
    return {
      id: row.id,
      name: row.name.trim(),
      ...(amount !== undefined ? { amount, unit: row.unit as Unit } : {}),
    };
  });
  const steps = draft.steps.map((row) => {
    if (!row.text.trim()) errors[`step-${row.id}`] = 'Hazırlama adımını yazın.';
    return { id: row.id, text: row.text.trim() };
  });
  if (new Set(ingredients.map((row) => row.id)).size !== ingredients.length ||
      new Set(steps.map((row) => row.id)).size !== steps.length ||
      [...ingredients, ...steps].some((row) => !row.id)) {
    errors.name = 'Satır kimlikleri geçersiz. Tarifi yeniden açın.';
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { name, normalizedName: normalizeName(name), calories: calories!, ingredients, steps };
}

export function createDatabase(name = 'portion') {
  const database = new Dexie(name) as Dexie & { recipes: EntityTable<Recipe, 'id'> };
  database.version(1).stores({ recipes: 'id, &normalizedName, createdAt' });
  return database;
}

export const database = createDatabase();

export function createId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function listRecipes(db = database): Promise<Recipe[]> {
  const recipes = await db.recipes.orderBy('createdAt').reverse().toArray();
  return recipes.sort((a, b) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt));
}

export async function reorderRecipes(ids: string[], db = database): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    const recipes = await listRecipes(db);
    const selected = new Set(ids);
    if (selected.size !== ids.length || ids.some((id) => !recipes.some((recipe) => recipe.id === id))) {
      throw new Error('Tarif sırası geçersiz.');
    }
    const ordered = ids.map((id) => recipes.find((recipe) => recipe.id === id)!);
    let index = 0;
    const base = Math.max(Date.now(), ...recipes.map((recipe) => recipe.createdAt));
    await db.recipes.bulkPut(recipes.map((recipe, position) => ({
      ...(selected.has(recipe.id) ? ordered[index++] : recipe), sortOrder: base - position,
    })));
  });
}

export async function readRecipe(id: string, db = database): Promise<Recipe> {
  const recipe = await db.recipes.get(id);
  if (!recipe) throw new Error('Tarif bulunamadı.');
  return recipe;
}

export async function saveRecipe(draft: Draft, id?: string, db = database): Promise<Recipe> {
  const values = validateDraft(draft);
  try {
    return await db.transaction('rw', db.recipes, async () => {
      const previous = id ? await readRecipe(id, db) : undefined;
      const latest = previous ? undefined : await db.recipes.orderBy('createdAt').last();
      const createdAt = previous?.createdAt ?? Math.max(Date.now(), (latest?.createdAt ?? 0) + 1);
      const recipe = { ...values, id: id ?? createId(), createdAt, ...(previous?.sortOrder !== undefined ? { sortOrder: previous.sortOrder } : {}) };
      await db.recipes.put(recipe);
      return recipe;
    });
  } catch (error) {
    if (error instanceof Dexie.ConstraintError) {
      throw new ValidationError({ name: 'Bu isimde bir tarif zaten var' });
    }
    throw error;
  }
}

export async function deleteRecipe(id: string, db = database): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    await readRecipe(id, db);
    await db.recipes.delete(id);
  });
}

export function toDraft(recipe: Recipe): Draft {
  return {
    name: recipe.name,
    calories: String(recipe.calories),
    ingredients: recipe.ingredients.map((row) => ({ ...row, amount: row.amount === undefined ? '' : String(row.amount), unit: row.unit ?? '' })),
    steps: recipe.steps.map((row) => ({ ...row })),
  };
}