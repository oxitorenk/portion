import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.BASE_PATH ?? '/';
const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.start_url, base);
assert.equal(manifest.scope, base);
const html = readFileSync('dist/index.html', 'utf8');
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(url.startsWith(base), `Alt dizin dışında varlık: ${url}`);
  assert.ok(existsSync(join('dist', url.slice(base.length))), `Varlık bulunamadı: ${url}`);
}
assert.deepEqual(new Set(manifest.icons?.map((icon) => icon.sizes)), new Set(['192x192', '512x512']));
for (const icon of manifest.icons) {
  const png = readFileSync(join('dist', icon.src));
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
}
const appleIcon = readFileSync('dist/apple-touch-icon.png');
assert.equal(appleIcon.readUInt32BE(16), 180);
assert.equal(appleIcon.readUInt32BE(20), 180);
assert.ok(html.includes('rel="apple-touch-icon"'), 'iOS simge bağlantısı eksik.');
const worker = readFileSync('dist/sw.js', 'utf8');
assert.ok(worker.includes('woff2'), 'Yerel fontlar önbellekte değil.');
assert.ok(worker.includes('index.html'), 'Uygulama kabuğu önbellekte değil.');
for (const file of ['apple-touch-icon.png', ...manifest.icons.map((icon) => icon.src)]) {
  assert.ok(worker.includes(file), `Simge önbellekte değil: ${file}`);
}
console.log(`PWA varlıkları ve kapsamı doğrulandı: ${base}`);
