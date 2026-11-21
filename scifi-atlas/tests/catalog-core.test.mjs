import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeText, buildIndex, filterEntries, getStats, getRelated } from '../assets/catalog-core.js';

const fixture = [
  {
    id: 'SF001', idea: 'Alpha robot 机器人', mechanism: '共同机制', constraint: '独有世界限制',
    category_no: 1, category: '人工智能与机器人', media: '文学',
    work_en: 'Shared Work', work_zh: '共用作品', author: 'Author A',
    subgenre_tags: ['人工智能', '意识与认知'], subgenre: '人工智能科幻',
    evidence_level: '直接支持', evidence: '直接支持（原作）',
    fulltext: '隐藏检索词', related_ids: ['SF003', 'SF003', 'SF001', 'SF999'],
    source_url: 'https://example.test/main',
    additional_source_url: ['https://example.test/main', 'https://example.test/detail'],
  },
  {
    id: 'SF002', idea: 'Beta robot', mechanism: '讨论 SF001 的另一项机制',
    category_no: 1, category: '人工智能与机器人', media: '动画剧集',
    work_en: ' shared work ', work_zh: '另一译名',
    subgenre_tags: ['人工智能'], subgenre: '人工智能科幻',
    evidence_level: '主题支持／细节待进一步核对', evidence: '主题支持（访谈）',
    related_ids: ['SF001'], source_url: 'https://example.test/main',
    constraint_source_url: 'https://example.test/context',
  },
  {
    id: 'SF003', idea: 'Gamma identity', category_no: 2, category: '意识与人格',
    medium: '桌游', media: '卡牌游戏', work_en: 'Another Work',
    subgenre_tags: ['意识与认知'], evidence_level: '直接支持', related_ids: [],
    source_url: 'https://example.test/main',
  },
  {
    id: 'SF004', idea: 'Delta memory', category_no: 3, category: '记忆与认知增强',
    media: '文学', work_zh: '中文独立标签', subgenre: '人工智能；记忆科幻',
    evidence: '直接支持', related_ids: [], source_url: 'https://example.test/other',
    title_source_url: 'https://example.test/detail',
  },
];

const ids = entries => entries.map(entry => entry.id);

test('normalization retains Chinese and folds case, Unicode width and whitespace', () => {
  assert.equal(normalizeText('  ＳＦ０１９\tAlpha 中文\n '), 'sf019 alpha 中文');
  assert.equal(normalizeText(null), '');
  assert.equal(normalizeText(0), '0');
  assert.equal(normalizeText(['Alpha', '中文']), 'alpha 中文');
});

test('indexing snapshots the list and filtering leaves input entries unchanged', () => {
  const input = structuredClone(fixture);
  const before = structuredClone(input);
  const index = buildIndex(input);
  assert.equal(index.byId.get('SF001'), input[0]);
  assert.deepEqual(ids(filterEntries(index)), ['SF001', 'SF002', 'SF003', 'SF004']);
  assert.deepEqual(input, before);
  input.push({ id: 'SF005' });
  assert.equal(index.entries.length, 4);
  assert.equal(filterEntries(index).length, 4);
});

test('multiword searches use AND across full text, including supplemental fulltext', () => {
  const index = buildIndex(fixture);
  assert.deepEqual(ids(filterEntries(index, { query: 'ALPHA 隐藏检索词' })), ['SF001']);
  assert.deepEqual(ids(filterEntries(index, { query: 'SHARED robot' })), ['SF001', 'SF002']);
  assert.deepEqual(ids(filterEntries(index, { query: 'Alpha impossible-token' })), []);
  assert.deepEqual(ids(filterEntries(index, { query: '独有世界限制' })), ['SF001']);
});

test('SF identifiers resolve precisely without matching references in other entries', () => {
  const index = buildIndex(fixture);
  for (const query of ['SF001', ' sf001 ', 'SF1', 'SF-001', 'SF 001', 'ＳＦ００１']) {
    assert.deepEqual(ids(filterEntries(index, { query })), ['SF001'], query);
  }
  assert.deepEqual(ids(filterEntries(index, { query: 'SF999' })), []);
  assert.deepEqual(ids(filterEntries(index, { query: 'SF001 alpha' })), ['SF001']);
  assert.deepEqual(ids(filterEntries(index, { query: 'SF001 beta' })), []);
  assert.deepEqual(ids(filterEntries(index, { query: 'SF001', media: '动画剧集' })), []);
});

test('facets combine, support normalized schema fields and preserve tag semantics', () => {
  const index = buildIndex(fixture);
  assert.deepEqual(ids(filterEntries(index, {
    category: '1', media: '文学', genre: '人工智能', evidence: '直接支持',
  })), ['SF001']);
  assert.deepEqual(ids(filterEntries(index, { category: '人工智能与机器人' })), ['SF001', 'SF002']);
  assert.deepEqual(ids(filterEntries(index, { genre: '意识与认知' })), ['SF001', 'SF003']);
  assert.deepEqual(ids(filterEntries(index, { media: '桌游' })), ['SF003']);
  assert.deepEqual(ids(filterEntries(index, { media: '卡牌游戏' })), ['SF003']);
  assert.deepEqual(ids(filterEntries(index, { evidence: '主题支持' })), ['SF002']);
  assert.deepEqual(ids(filterEntries(index, { evidence: '主题支持／细节待进一步核对' })), ['SF002']);
  assert.deepEqual(ids(filterEntries(index, { genre: '记忆科幻' })), ['SF004']);
  assert.equal(filterEntries(index, { category: 'all', media: '', genre: null }).length, 4);
  assert.deepEqual(ids(filterEntries(index, { category: ['1', '2'] })), ['SF001', 'SF002', 'SF003']);
});

test('bookmarks accept arrays or Sets and combine with all other filters', () => {
  const index = buildIndex(fixture);
  assert.deepEqual(ids(filterEntries(index, { bookmarkedOnly: true, bookmarks: ['sf1', 'SF003'] })), ['SF001', 'SF003']);
  assert.deepEqual(ids(filterEntries(index, {
    bookmarkedOnly: true, bookmarks: new Set(['SF001', 'SF003']), media: '文学',
  })), ['SF001']);
  assert.deepEqual(filterEntries(index, { bookmarkedOnly: true }), []);
  assert.equal(filterEntries(index, { bookmarks: ['SF001'] }).length, 4);
});

test('statistics count actual records, title labels, facets and distinct source URLs', () => {
  const stats = getStats(fixture);
  assert.equal(stats.totalEntries, 4);
  assert.equal(stats.totalWorks, 3);
  assert.equal(stats.workCountBasis, 'normalized-source-title-labels');
  assert.equal(stats.totalCategories, 3);
  assert.equal(stats.totalMedia, 3);
  assert.equal(stats.totalSources, 4);
  assert.equal(stats.totalPrimarySources, 2);
  assert.equal(stats.genres.find(item => item.value === '人工智能').count, 3);
  assert.equal(stats.media.find(item => item.value === '文学').count, 2);
  assert.equal(stats.media.find(item => item.value === '桌游').count, 1);
  assert.deepEqual(stats.categories.map(item => item.value), ['1', '2', '3']);

  const subsetStats = getStats(filterEntries(buildIndex(fixture), { media: '桌游' }));
  assert.equal(subsetStats.totalEntries, 1);
  assert.equal(subsetStats.totalWorks, 1);
  assert.equal(subsetStats.totalSources, 1);

  const empty = getStats([]);
  for (const key of ['totalEntries', 'totalWorks', 'totalCategories', 'totalMedia', 'totalGenres', 'totalSources', 'totalPrimarySources']) {
    assert.equal(empty[key], 0, key);
  }
  assert.deepEqual(empty.categories, []);
  assert.deepEqual(empty.evidence, []);
});

test('related records prioritize explicit outgoing and incoming links, then shared themes', () => {
  const entries = [...fixture, { ...fixture[1] }];
  assert.deepEqual(ids(getRelated(fixture[0], entries)), ['SF003', 'SF002', 'SF004']);
  assert.deepEqual(ids(getRelated(fixture[0], entries, 1)), ['SF003']);
  assert.deepEqual(ids(getRelated(fixture[0], entries, 2)), ['SF003', 'SF002']);
  assert.deepEqual(getRelated(fixture[0], entries, 0), []);
  assert.deepEqual(getRelated(fixture[0], entries, -1), []);
  assert.equal(getRelated(fixture[2], entries, 1)[0].id, 'SF001');
  assert.ok(!ids(getRelated({ ...fixture[0] }, entries)).includes('SF001'));
});

test('unrelated entries are not inserted merely to fill the recommendation limit', () => {
  const isolated = { id: 'SF998', category_no: 99, category: '独立主题', subgenre_tags: ['独立标签'] };
  assert.deepEqual(getRelated(isolated, fixture), []);
});

test('the published 240-entry catalogue keeps exact IDs, complete evidence and bidirectional links', async () => {
  const dataPath = process.env.SCIFI_CATALOG_TEST_PATH || new URL('../data/catalog.json', import.meta.url);
  const payload = JSON.parse(await readFile(dataPath, 'utf8'));
  const entries = Array.isArray(payload) ? payload : payload.entries;
  const index = buildIndex(entries);
  const stats = getStats(entries);
  assert.equal(stats.totalEntries, 240);
  assert.equal(stats.totalCategories, 20);
  assert.equal(stats.totalMedia, 14);
  assert.equal(stats.totalPrimarySources, 219);
  assert.equal(stats.totalSources, 230);
  assert.equal(stats.totalWorks, 213);
  assert.deepEqual(ids(filterEntries(index, { query: 'sf019' })), ['SF019']);
  assert.deepEqual(ids(filterEntries(index, { query: 'NEUROMANCER 脑机' })), ['SF019']);
  assert.equal(filterEntries(index, { media: '文学' }).length, 120);
  const thematic = filterEntries(index, { evidence: '主题支持' });
  assert.equal(thematic.length, 10);
  assert.ok(ids(thematic).includes('SF227'));
  assert.equal(filterEntries(index, { evidence: '直接支持' }).length, 230);
  assert.deepEqual(ids(getRelated(index.byId.get('SF008'), entries, 4)), ['SF137', 'SF181', 'SF227', 'SF238']);
  const timeLinks = ids(getRelated(index.byId.get('SF167'), entries));
  assert.equal(timeLinks[0], 'SF210');
  assert.equal(timeLinks.filter(id => id === 'SF210').length, 1);
  assert.ok(!timeLinks.includes('SF167'));
});
