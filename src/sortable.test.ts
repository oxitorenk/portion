import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import Sortable from 'sortablejs';
import { sortable } from './sortable.ts';

test('sorting restores Svelte boundaries before notifying all three list consumers', () => {
  const originalMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
  try {
    for (const list of ['recipes', 'ingredients', 'steps']) {
      for (const [from, to] of [[0, 2], [2, 0], [1, 1]]) {
        type Item = { id: string; nextSibling: Item | null };
        const children: Item[] = [];
        function item(id: string): Item {
          return { id, get nextSibling() { return children[children.indexOf(this) + 1] ?? null; } };
        }
        const a = item('a'), b = item('b'), c = item('c');
        const start = item('#start'), end = item('#end'), text = item('#text');
        children.push(start, a, text, b, c, end);
        const original = [...children];
        const rows = () => children.filter((node) => !node.id.startsWith('#'));
        const host = { insertBefore(node: Item, next: Item | null) {
          children.splice(children.indexOf(node), 1);
          children.splice(next === null ? children.length : children.indexOf(next), 0, node);
        } };
        let callbacks = 0;
        let config: Sortable.Options;
        const instance = { toArray: () => rows().map((node) => node.id), option() {}, destroy() {}, sort() { assert.fail('must not append rows past Svelte anchors'); } };
        const create = mock.method(Sortable, 'create', (_node, options) => {
          config = options;
          return instance as unknown as Sortable;
        });
        const action = sortable(host as unknown as HTMLElement, { disabled: false, onchange(ids) {
          callbacks++;
          assert.deepEqual(children, original, `${list}: DOM must be restored before state changes`);
          const expected = ['a', 'b', 'c'];
          expected.splice(to, 0, expected.splice(from, 1)[0]);
          assert.deepEqual(ids, expected);
        } });
        try {
          const dragged = rows()[from];
          const event = { item: dragged, oldDraggableIndex: from, newDraggableIndex: to } as unknown as Sortable.SortableEvent;
          config!.onChoose!.call(instance as unknown as Sortable, event);
          const remaining = rows().filter((row) => row !== dragged);
          host.insertBefore(dragged, remaining[to] ?? end);
          config!.onEnd!.call(instance as unknown as Sortable, event);
          assert.deepEqual(children, original, `${list}: preserve every text/comment boundary`);
          assert.equal(callbacks, from === to ? 0 : 1);
          // Svelte can now remove its complete branch without leaving orphan rows.
          const branch = children.splice(children.indexOf(start), children.indexOf(end) - children.indexOf(start) + 1);
          assert.equal(branch.length, original.length);
          assert.equal(children.length, 0);
        } finally { action.destroy(); create.mock.restore(); }
      }
    }
  } finally {
    if (originalMedia) Object.defineProperty(globalThis, 'matchMedia', originalMedia);
    else Reflect.deleteProperty(globalThis, 'matchMedia');
  }
});
