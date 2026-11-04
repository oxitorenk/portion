import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visibilityScroll } from './keepFieldVisible.ts';

test('klavye üzerindeki alan sabit kalır, gizlenen alan en az mesafeyle görünür olur', () => {
  assert.equal(visibilityScroll(100, 200, 40, 400), 0);
  assert.equal(visibilityScroll(350, 450, 40, 400), 50);
  assert.equal(visibilityScroll(20, 120, 40, 400), -20);
  assert.equal(visibilityScroll(350, 900, 40, 400), 310);
  assert.equal(visibilityScroll(40, 900, 40, 400), 0);
  assert.equal(visibilityScroll(380, 480, 240, 440), 40);
});
