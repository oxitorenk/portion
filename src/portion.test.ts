import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePortions, scaleAmount, scaleCalories } from './portion.ts';

test('porsiyon: nokta/virgül, pozitif ve iki basamak', () => {
  assert.equal(parsePortions('0,75'), .75);
  assert.equal(parsePortions('1.25'), 1.25);
  for (const value of ['', '0', '-1', '1.234', 'NaN', 'Infinity', '1e2']) assert.equal(parsePortions(value), undefined);
});
test('hesaplar kayıtlı değerden; küçük miktarlar ve kalori', () => {
  assert.equal(scaleAmount(100, .75), '75');
  assert.equal(scaleCalories(200, .75), '150');
  assert.equal(scaleAmount(1.005, 3), '3.01');
  assert.equal(scaleAmount(1.005, 1), '1.01');
  assert.equal(scaleAmount(.001, 1), '<0.01');
  assert.equal(scaleAmount(.01, 1), '0.01');
  assert.equal(scaleAmount(75.5, 1), '75.5');
  assert.equal(scaleCalories(200.5, 1), '201');
  assert.equal(scaleAmount(Number.MAX_VALUE, 2), 'Hesaplanamıyor');
});
