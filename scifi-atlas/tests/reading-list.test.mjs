import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIndex } from '../assets/catalog-core.js';
import { parseReadingList } from '../assets/reading-list.js';

const entries = [
  { id: 'SF001', idea: '原始目录标题一' },
  { id: 'SF002', idea: '原始目录标题二' },
  { id: 'SF003', idea: '原始目录标题三' },
];
const index = buildIndex(entries);

test('site exports produce a normalized merge proposal without adopting imported content', () => {
  const input = {
    title: '任意标题', count: 9000, source: 'javascript:alert(1)',
    entries: [{ id: 'sf1', idea: '<script>伪造内容</script>' }, { id: 'SF002', source_url: 'javascript:alert(2)' }],
  };
  const bookmarks = new Set(['SF003', 'SF001']);
  const before = structuredClone(input);
  const result = parseReadingList(JSON.stringify(input), index, { bookmarks });
  assert.equal(result.ok, true);
  assert.equal(result.format, 'site-export');
  assert.equal(result.totalItems, 2);
  assert.deepEqual(result.ids, ['SF001', 'SF002']);
  assert.deepEqual(result.mergedIds, ['SF003', 'SF001', 'SF002']);
  assert.deepEqual(result.addedIds, ['SF002']);
  assert.deepEqual(result.alreadySavedIds, ['SF001']);
  assert.equal(JSON.stringify(result).includes('script'), false);
  assert.deepEqual(input, before);
  assert.deepEqual([...bookmarks], ['SF003', 'SF001']);
  assert.equal(entries[0].idea, '原始目录标题一');
});

test('ID arrays separate invalid, unknown, repeated and already-saved identifiers', () => {
  const input = [' sf1 ', 'ＳＦ－００２', 'SF1', 'SF999', 0, {}, 'javascript:alert(1)', 'SF000'];
  const result = parseReadingList(input, entries, { bookmarks: new Set(['SF001', 'sf3', 'SF999']) });
  assert.equal(result.ok, true);
  assert.equal(result.format, 'id-array');
  assert.deepEqual(result.ids, ['SF001', 'SF002']);
  assert.deepEqual(result.mergedIds, ['SF001', 'SF003', 'SF002']);
  assert.deepEqual(result.addedIds, ['SF002']);
  assert.deepEqual(result.alreadySavedIds, ['SF001']);
  assert.deepEqual(result.unknown, [{ index: 3, id: 'SF999' }]);
  assert.deepEqual(result.duplicates, [{ index: 2, id: 'SF001' }]);
  assert.equal(result.invalid.length, 4);
  assert.equal(result.totalItems, result.ids.length + result.unknown.length + result.invalid.length + result.duplicates.length);
  assert.equal(JSON.stringify(result).includes('javascript'), false);
});

test('empty, malformed or unsupported files never propose clearing existing bookmarks', () => {
  for (const input of ['', '  ', '{', 'null', '"SF001"', '{}', '{"entries":"SF001"}']) {
    const result = parseReadingList(input, index, { bookmarks: ['sf3', 'SF003'] });
    assert.equal(result.ok, false, input);
    assert.equal(result.errors.length, 1, input);
    assert.deepEqual(result.ids, [], input);
    assert.deepEqual(result.mergedIds, ['SF003'], input);
  }
  const empty = parseReadingList('[]', index, { bookmarks: ['SF003'] });
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.mergedIds, ['SF003']);
  assert.deepEqual(empty.addedIds, []);
});

test('UTF-8 BOM exports and Unicode identifier variants are accepted', () => {
  const result = parseReadingList('\uFEFF ["#ＳＦ０１", "SF–002", "SF_003"]\n', index);
  assert.equal(result.ok, true);
  assert.deepEqual(result.ids, ['SF001', 'SF002', 'SF003']);
});

test('objects cannot execute accessors or coercion hooks through imported record fields', () => {
  let executed = 0;
  const data = {
    entries: [
      { id: 'SF001', get idea() { executed++; throw new Error('must not read imported text'); } },
      { get id() { executed++; return 'SF002'; } },
      { id: { toString() { executed++; return 'SF002'; } } },
      Object.create({ id: 'SF003' }),
    ],
  };
  const result = parseReadingList(data, index);
  assert.equal(executed, 0);
  assert.deepEqual(result.ids, ['SF001']);
  assert.equal(result.invalid.length, 3);
  const accessorRoot = { get entries() { executed++; return [{ id: 'SF001' }]; } };
  assert.equal(parseReadingList(accessorRoot, index).ok, false);
  assert.equal(executed, 0);

  const hostile = JSON.parse('{"__proto__":{"polluted":true},"entries":[{"id":"SF002","__proto__":{"polluted":true}}]}');
  assert.deepEqual(parseReadingList(hostile, index).ids, ['SF002']);
  assert.equal({}.polluted, undefined);

  const sparse = ['SF001'];
  Object.defineProperty(sparse, '1', { get() { executed++; return 'SF002'; } });
  sparse.length = 3;
  sparse.forEach = () => { executed++; };
  const sparseResult = parseReadingList(sparse, index);
  assert.equal(executed, 0);
  assert.deepEqual(sparseResult.ids, ['SF001']);
  assert.equal(sparseResult.invalid.length, 2);
});

test('a valid-format file containing no accepted IDs is a no-op merge with a report', () => {
  const result = parseReadingList(['SF999', '<img src=x onerror=alert(1)>'], index, { bookmarks: ['SF002'] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ids, []);
  assert.deepEqual(result.mergedIds, ['SF002']);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.unknown.length, 1);
});

test('the complete current catalogue can round-trip through the site export format', async () => {
  const dataPath = process.env.SCIFI_CATALOG_TEST_PATH || new URL('../data/catalog.json', import.meta.url);
  const payload = JSON.parse(await readFile(dataPath, 'utf8'));
  const catalog = Array.isArray(payload) ? payload : payload.entries;
  const result = parseReadingList(JSON.stringify({ title: '阅读清单', entries: catalog }), buildIndex(catalog));
  assert.equal(result.ok, true);
  assert.equal(result.ids.length, 240);
  assert.deepEqual(result.mergedIds, catalog.map(entry => entry.id));
  assert.deepEqual(result.invalid, []);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.duplicates, []);
});
