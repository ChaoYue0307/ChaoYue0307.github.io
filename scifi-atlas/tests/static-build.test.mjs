import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildFiles, buildStatic, validateCatalog, renderHomePreview, updateHomePreview, GENERATED_MARKER } from '../scripts/build-static.mjs';
import { escapeHTML, sourceLinks } from '../assets/ui.js';

const siteDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const payload = JSON.parse(await readFile(path.join(siteDir, 'data/catalog.json'), 'utf8'));
const files = buildFiles(payload);

test('all entries have independently readable canonical pages and a bounded semantic index', () => {
  assert.equal(files.size, payload.entries.length + 2);
  const catalog = files.get('catalog/index.html');
  const sitemap = files.get('sitemap.xml');
  assert.equal((catalog.match(/class="static-topic-section"/g) || []).length, 20);
  assert.equal((catalog.match(/class="static-index-item"/g) || []).length, payload.entries.length);
  assert.equal((sitemap.match(/<loc>/g) || []).length, payload.entries.length + 2);
  assert.ok(!sitemap.includes('#'));
  assert.ok(!sitemap.includes('<lastmod>'));
  assert.ok(!catalog.includes('assets/app.js'));
  assert.ok(!catalog.includes('assets/entry.js'));
  for (const entry of payload.entries) {
    const html = files.get(`ideas/${entry.id}/index.html`);
    assert.ok(html, entry.id);
    assert.ok(html.includes(`data-entry-id="${entry.id}"`));
    assert.ok(html.includes(`rel="canonical" href="https://chaoyue0307.github.io/scifi-atlas/ideas/${entry.id}/"`));
    assert.ok(html.includes(`href="../ideas/${entry.id}/"`) === false);
    assert.ok(catalog.includes(`href="../ideas/${entry.id}/"`));
    for (const key of ['idea', 'premise', 'mechanism', 'implication', 'constraint', 'author']) assert.ok(html.includes(escapeHTML(entry[key])), `${entry.id}.${key}`);
    for (const source of sourceLinks(entry)) {
      assert.ok(html.includes(`href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer"`));
      assert.ok(html.includes(`aria-label="${escapeHTML(`${source.label} ${source.domain}（外部资料，新窗口打开）`)}"`), `${entry.id}: source accessible name includes both visible title and domain`);
    }
    assert.ok(html.includes('data-entry-actions hidden'));
    assert.ok(html.includes('assets/entry.js'));
    assert.ok(!html.includes('assets/app.js'));
    assert.ok(!html.includes('data/catalog.json'));
    assert.ok(html.includes('整理分析'));
  }
});

test('JSON-LD matches visible entries and its exact bytes are authorized by CSP', () => {
  for (const [filename, html] of files) {
    if (!filename.endsWith('.html')) continue;
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(match, filename);
    const schema = JSON.parse(match[1]);
    const hash = createHash('sha256').update(match[1]).digest('base64');
    assert.ok(html.includes(`sha256-${hash}`), filename);
    assert.ok(!html.includes("unsafe-inline"));
    assert.ok(!html.includes('frame-ancestors'));
    assert.ok(!/"(?:datePublished|dateModified|license)"\s*:/.test(match[1]));
    assert.ok(schema['@graph'].some(node => node['@type'] === 'BreadcrumbList'));
    if (filename.startsWith('ideas/')) assert.equal(schema['@graph'][0]['@type'], 'WebPage');
  }
});

test('generated attributes, source URLs and JSON data remain safe with untrusted text', () => {
  const malicious = structuredClone(payload.entries[0]);
  malicious.id = 'SF999'; malicious.related_ids = [];
  malicious.idea = '</script><script>alert("x")</script><img src=x onerror=alert(1)>';
  malicious.author = 'A & B "quoted"';
  const result = buildFiles({ entries: [malicious] }, { baseUrl: 'https://example.test/scifi-atlas/' });
  const html = result.get('ideas/SF999/index.html');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B &quot;quoted&quot;'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('</script><script>alert'));
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(json)['@graph'][0].name, malicious.idea);
  assert.throws(() => buildFiles({ entries: [{ ...malicious, source_url: 'javascript:alert(1)' }] }), /Unsafe or invalid source/);
  assert.throws(() => buildFiles({ entries: [malicious] }, { baseUrl: 'javascript:alert(1)' }), /HTTP\(S\)/);
  assert.throws(() => buildFiles({ entries: [malicious] }, { manifestPath: '../outside.webmanifest' }), /within the site/);
});

test('validation rejects duplicate IDs, unsafe output paths and broken references', () => {
  const entry = { ...payload.entries[0], related_ids: [] };
  assert.throws(() => validateCatalog({ entries: [entry, { ...entry }] }), /duplicate/);
  assert.throws(() => validateCatalog({ entries: [{ ...entry, id: '../SF001' }] }), /Invalid/);
  assert.throws(() => validateCatalog({ entries: [{ ...entry, related_ids: ['SF999'] }] }), /Invalid related/);
  assert.throws(() => validateCatalog({ entries: [{ ...entry, related_ids: [entry.id] }] }), /Invalid related/);
});

test('home preview offers four real links and changes only its controlled region', () => {
  const before = '<!-- preserve -->\n<head>unchanged</head>\n<!-- ATLAS_PREVIEW_START -->old\n<!-- ATLAS_PREVIEW_END -->\n<footer>untouched</footer>';
  const preview = renderHomePreview(payload);
  const result = updateHomePreview(before, preview);
  assert.ok(result.startsWith('<!-- preserve -->\n<head>unchanged</head>\n<!-- ATLAS_PREVIEW_START -->\n'));
  assert.ok(result.endsWith('\n<!-- ATLAS_PREVIEW_END -->\n<footer>untouched</footer>'));
  for (const id of ['SF001', 'SF008', 'SF135', 'SF201']) assert.ok(result.includes(`href="./ideas/${id}/" data-idea="${id}"`));
  assert.ok(result.includes('href="./catalog/"'));
  assert.ok(!result.includes('data-action="bookmark"'));
  assert.throws(() => updateHomePreview('<html>no markers</html>', preview), /marker pair/);
  assert.throws(() => updateHomePreview('<!-- ATLAS_PREVIEW_END --><!-- ATLAS_PREVIEW_START -->', preview), /marker pair/);
});

test('builds are deterministic; check mode never writes; unrelated files and source data survive', async t => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'scifi-static-build-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await mkdir(path.join(fixture, 'data'), { recursive: true });
  const source = JSON.stringify({ entries: [{ ...payload.entries[0], related_ids: [] }] });
  await writeFile(path.join(fixture, 'data/catalog.json'), source);
  const home = '<!-- keep this exact comment -->\nRoot-owned entry.\n<!-- ATLAS_PREVIEW_START -->placeholder<!-- ATLAS_PREVIEW_END -->\n<footer>Root-owned footer.</footer>\n';
  await writeFile(path.join(fixture, 'index.html'), home);
  const absent = await buildStatic({ siteDir: fixture, check: true });
  assert.equal(absent.ok, false);
  await assert.rejects(readFile(path.join(fixture, 'catalog/index.html')), { code: 'ENOENT' });
  const first = await buildStatic({ siteDir: fixture });
  assert.equal(first.changed.length, 4);
  const before = await stat(path.join(fixture, 'catalog/index.html'));
  const verified = await buildStatic({ siteDir: fixture, check: true });
  assert.equal(verified.ok, true);
  assert.deepEqual(verified.changed, []);
  const second = await buildStatic({ siteDir: fixture });
  assert.deepEqual(second.changed, []);
  assert.equal((await stat(path.join(fixture, 'catalog/index.html'))).mtimeMs, before.mtimeMs);
  assert.equal(await readFile(path.join(fixture, 'data/catalog.json'), 'utf8'), source);
  assert.equal(await readFile(path.join(fixture, 'index.html'), 'utf8'), updateHomePreview(home, renderHomePreview(JSON.parse(source))));
  await mkdir(path.join(fixture, 'ideas/SF998'), { recursive: true });
  await writeFile(path.join(fixture, 'ideas/SF998/index.html'), `${GENERATED_MARKER}\nobsolete`);
  await mkdir(path.join(fixture, 'ideas/SF999'), { recursive: true });
  await writeFile(path.join(fixture, 'ideas/SF999/index.html'), '<!-- handwritten page, keep -->');
  const stale = await buildStatic({ siteDir: fixture, check: true });
  assert.deepEqual(stale.stale, ['ideas/SF998/index.html']);
  await buildStatic({ siteDir: fixture });
  await assert.rejects(readFile(path.join(fixture, 'ideas/SF998/index.html')), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(fixture, 'ideas/SF999/index.html'), 'utf8'), '<!-- handwritten page, keep -->');
  assert.deepEqual([...buildFiles(payload)], [...buildFiles(payload)]);
});
