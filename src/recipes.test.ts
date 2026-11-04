import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabase, createId, deleteRecipe, listRecipes, normalizeName, readRecipe, reorderRecipes, saveRecipe, toDraft, ValidationError, type Draft } from './recipes.ts';

const draft = (): Draft => ({
  name: ' Tavuk  PİLAV ', calories: '200,5',
  ingredients: [{ id: 'rice', name: 'pirinç', amount: '100', unit: 'g' }, { id: 'salt', name: 'isteğe göre tuz', amount: '', unit: '' }],
  steps: [{ id: 'cook', text: 'Pişirin.' }],
});

test('kimlikler 128 bit rastgele ve yerel HTTP ile uyumlu', () => {
  const ids = Array.from({ length: 100 }, () => createId());
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[a-f0-9]{32}$/u.test(id)));
});

test('Türkçe isim normalizasyonu', () => {
  assert.equal(normalizeName('  IŞIK\t ÇORBASI  '), 'ışık çorbası');
  assert.equal(normalizeName('PİLAV'), normalizeName('pilav'));
});

test('atomik benzersizlik, güncelleme, sıra, rollback ve silme', async () => {
  const db = createDatabase(`test-${crypto.randomUUID()}`);
  try {
    const results = await Promise.allSettled([saveRecipe(draft(), undefined, db), saveRecipe(draft(), undefined, db)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected' && result.reason instanceof ValidationError).length, 1);
    const [saved] = await listRecipes(db);
    assert.equal(saved.calories, 200.5);
    assert.deepEqual(saved.ingredients.map((row) => row.id), ['rice', 'salt']);
    const updated = await saveRecipe({ ...draft(), name: 'tavuk pilav', steps: [{ id: 'new', text: 'Dinlendirin.' }] }, saved.id, db);
    assert.equal(updated.createdAt, saved.createdAt);
    assert.equal((await listRecipes(db)).length, 1);
    const other = await saveRecipe({ ...draft(), name: 'Diğer tarif' }, undefined, db);
    assert.equal((await listRecipes(db))[0].id, other.id);
    await assert.rejects(saveRecipe({ ...draft(), name: 'DİĞER TARİF' }, saved.id, db), ValidationError);
    assert.deepEqual(await readRecipe(saved.id, db), updated);
    await assert.rejects(db.transaction('rw', db.recipes, async () => {
      await saveRecipe({ ...draft(), name: 'Geçici ad' }, saved.id, db);
      throw new Error('Yazma başarısız');
    }));
    assert.deepEqual(await readRecipe(saved.id, db), updated);
    await deleteRecipe(other.id, db);
    await assert.rejects(readRecipe(other.id, db));
    await assert.rejects(saveRecipe(draft(), 'missing', db));
  } finally {
    await db.delete();
  }
});

test('zorunlu alanlar, birim ve geçersiz sayılar', async () => {
  for (const invalid of ['', ' ', '-1', 'Infinity', 'NaN', '1e3', '1,2.3', '9'.repeat(400)]) {
    await assert.rejects(saveRecipe({ ...draft(), calories: invalid }), ValidationError);
    await assert.rejects(saveRecipe({ ...draft(), ingredients: [{ id: 'a', name: 'Un', amount: invalid.trim() || '0', unit: 'g' }] }), ValidationError);
  }
  for (const patch of [{ name: ' ' }, { ingredients: [] }, { steps: [] }, { steps: [{ id: 'a', text: ' ' }] },
    { ingredients: [{ id: 'a', name: ' ', amount: '', unit: '' }] },
    { ingredients: [{ id: 'a', name: 'Un', amount: '1', unit: '' }] }]) {
    await assert.rejects(saveRecipe({ ...draft(), ...patch }), ValidationError);
  }
});

test('okuma/yazma/silme hataları reddedilir; tekrar açınca veri korunur', async () => {
  const db = createDatabase(`test-${crypto.randomUUID()}`);
  try {
    const saved = await saveRecipe(draft(), undefined, db);
    db.close({ disableAutoOpen: true });
    await assert.rejects(listRecipes(db));
    await assert.rejects(readRecipe(saved.id, db));
    await assert.rejects(saveRecipe({ ...draft(), name: 'Başarısız değişiklik' }, saved.id, db));
    await assert.rejects(deleteRecipe(saved.id, db));
    await db.open();
    assert.deepEqual(await readRecipe(saved.id, db), saved);
  } finally { await db.delete(); }
});


test('tarif sırası kalıcıdır, filtre dışındaki tarifleri ve düzenlemeleri korur', async () => {
  const db = createDatabase(`test-${crypto.randomUUID()}`);
  try {
    const a = await saveRecipe({ ...draft(), name: 'A' }, undefined, db);
    const b = await saveRecipe({ ...draft(), name: 'B' }, undefined, db);
    const c = await saveRecipe({ ...draft(), name: 'C' }, undefined, db);
    await reorderRecipes([a.id, c.id], db);
    const expected = [a.id, b.id, c.id];
    assert.deepEqual((await listRecipes(db)).map((row) => row.id), expected);
    await saveRecipe({ ...draft(), name: 'A düzenlendi' }, a.id, db);
    db.close();
    await db.open();
    assert.deepEqual((await listRecipes(db)).map((row) => row.id), expected);
    await assert.rejects(reorderRecipes([a.id, a.id], db));
    await assert.rejects(reorderRecipes([a.id, 'missing'], db));
    assert.deepEqual((await listRecipes(db)).map((row) => row.id), expected);
    const added = await saveRecipe({ ...draft(), name: 'Yeni' }, undefined, db);
    assert.equal((await listRecipes(db))[0].id, added.id);
  } finally { await db.delete(); }
});


test('kaşık birimleri kaydedilir ve düzenleme için korunur', async () => {
  const db = createDatabase(`test-${crypto.randomUUID()}`);
  try {
    for (const unit of ['çay kaşığı', 'yemek kaşığı', 'tatlı kaşığı']) {
      const saved = await saveRecipe({ ...draft(), name: unit, ingredients: [{ id: 'spoon', name: 'Tuz', amount: '1,5', unit }] }, undefined, db);
      const recipe = await readRecipe(saved.id, db);
      assert.deepEqual(recipe.ingredients[0], { id: 'spoon', name: 'Tuz', amount: 1.5, unit });
      assert.equal(toDraft(recipe).ingredients[0].unit, unit);
    }
    await assert.rejects(saveRecipe({ ...draft(), ingredients: [{ id: 'bad', name: 'Tuz', amount: '1', unit: 'geçersiz' }] }, undefined, db), ValidationError);
  } finally { await db.delete(); }
});
