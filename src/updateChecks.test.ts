import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updateChecks } from './updateChecks.ts';

test('açılış, geri dönüş ve bağlantıda kontrol; çevrimdışı ve eşzamanlı kontroller atlanır', async () => {
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const browser = new EventTarget();
  const network = { onLine: true };
  const originals = ['document', 'window', 'navigator'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'document', { configurable: true, value: page });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: network });
  let calls = 0;
  let finish: () => void = () => {};
  const registration = { update() { calls++; return new Promise<void>((resolve) => { finish = resolve; }); } } as unknown as ServiceWorkerRegistration;
  let stop: (() => void) | undefined;
  try {
    stop = updateChecks(registration);
    assert.equal(calls, 1);
    browser.dispatchEvent(new Event('pageshow'));
    assert.equal(calls, 1);
    finish(); await Promise.resolve();
    page.visibilityState = 'hidden';
    page.dispatchEvent(new Event('visibilitychange'));
    assert.equal(calls, 1);
    page.visibilityState = 'visible';
    page.dispatchEvent(new Event('visibilitychange'));
    assert.equal(calls, 2);
    finish(); await Promise.resolve();
    network.onLine = false;
    browser.dispatchEvent(new Event('pageshow'));
    assert.equal(calls, 2);
    network.onLine = true;
    browser.dispatchEvent(new Event('online'));
    assert.equal(calls, 3);
    finish(); await Promise.resolve();
    registration.update = async () => { calls++; throw new Error('offline'); };
    browser.dispatchEvent(new Event('pageshow'));
    await Promise.resolve();
    browser.dispatchEvent(new Event('online'));
    await Promise.resolve();
    assert.equal(calls, 5);
    stop();
    browser.dispatchEvent(new Event('online'));
    page.dispatchEvent(new Event('visibilitychange'));
    assert.equal(calls, 5);
  } finally {
    stop?.();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
