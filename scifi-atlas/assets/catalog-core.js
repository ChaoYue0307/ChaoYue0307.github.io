/** Pure, dependency-free queries for the science-fiction idea catalogue. */

const SEARCH_FIELDS = [
  'id', 'idea', 'premise', 'mechanism', 'implication', 'constraint',
  'work_zh', 'work_en', 'author', 'kind', 'form', 'category', 'category_no',
  'medium', 'media', 'media_detail', 'subgenre', 'subgenre_tags',
  'evidence', 'evidence_level', 'idea_layer', 'adaptation_note',
  'shared_motif', 'variant_of', 'source_title', 'fulltext',
];

function textValue(value) {
  if (value == null) return '';
  if (Array.isArray(value) || value instanceof Set) {
    return Array.from(value, textValue).join(' ');
  }
  return typeof value === 'object' ? '' : String(value);
}

/** Fold Unicode width, case and whitespace without removing Chinese text. */
export function normalizeText(value) {
  return textValue(value).normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function requireEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError('Expected an array of catalogue entries.');
  return entries;
}

function values(value) {
  if (value == null) return [];
  return (Array.isArray(value) || value instanceof Set ? Array.from(value) : [value])
    .flatMap(item => Array.isArray(item) ? values(item) : [textValue(item).trim()])
    .filter(Boolean);
}

function idKey(value) {
  const normalized = normalizeText(value);
  const match = normalized.match(/^sf[\s_-]*0*(\d{1,9})$/u);
  return match ? `SF${String(Number(match[1])).padStart(3, '0')}` : normalized.toUpperCase();
}

function uniqueNormalized(items) {
  return new Set(items.map(normalizeText).filter(Boolean));
}

function genreLabels(entry) {
  const tags = values(entry.subgenre_tags);
  return tags.length ? tags : values(entry.subgenre).flatMap(value => value.split(/[;；/／、|,，]/u)).map(value => value.trim()).filter(Boolean);
}

function evidenceLabel(entry) {
  const level = textValue(entry.evidence_level).trim();
  if (level) return level;
  const raw = textValue(entry.evidence).trim();
  if (raw.startsWith('直接支持')) return '直接支持';
  if (raw.startsWith('主题支持')) return '主题支持';
  return raw || '未标注';
}

function makeRecord(entry, order) {
  const evidenceKeys = uniqueNormalized([entry.evidence_level, entry.evidence, evidenceLabel(entry)]);
  for (const key of Array.from(evidenceKeys)) {
    if (key.startsWith('直接支持')) evidenceKeys.add('直接支持');
    if (key.startsWith('主题支持')) evidenceKeys.add('主题支持');
  }
  const genreKeys = uniqueNormalized([
    ...genreLabels(entry), ...values(entry.subgenre),
    ...values(entry.subgenre).flatMap(value => value.split(/[;；/／、|,，]/u)),
  ]);
  return {
    entry,
    order,
    id: idKey(entry.id),
    text: normalizeText(SEARCH_FIELDS.map(field => textValue(entry[field])).join(' ')),
    categoryKeys: uniqueNormalized([entry.category_no, entry.category]),
    mediaKeys: uniqueNormalized([...values(entry.medium), ...values(entry.media)]),
    genreKeys,
    evidenceKeys,
  };
}

/**
 * Precompute searchable text and facet keys without changing the input records.
 * byId uses canonical keys such as SF019; duplicate IDs retain their first record.
 */
export function buildIndex(entries = []) {
  const snapshot = requireEntries(entries).slice();
  const records = snapshot.map(makeRecord);
  const byId = new Map();
  for (const record of records) {
    if (record.id && !byId.has(record.id)) byId.set(record.id, record.entry);
  }
  return { entries: snapshot, records, byId };
}

function selectedKeys(value) {
  const selected = values(value).map(normalizeText);
  return selected.some(key => key === 'all' || key === '全部') ? [] : selected;
}

function matchesFacet(available, selected) {
  return selected.length === 0 || selected.some(key => available.has(key));
}

/**
 * Return original entry objects. Words are ANDed; values within one facet are ORed.
 * A pure SF identifier is an exact lookup, never a match on a related-ID mention.
 * SF19, sf019, SF-019 and full-width equivalents all resolve to SF019.
 */
export function filterEntries(index, filters = {}) {
  const prepared = index?.records ? index : buildIndex(Array.isArray(index) ? index : index?.entries || []);
  const { query = '', category, media, genre, evidence, bookmarkedOnly = false, bookmarks = [] } = filters || {};
  const queryText = normalizeText(query);
  const exactId = /^sf[\s_-]*\d{1,9}$/u.test(queryText) ? idKey(queryText) : '';
  const tokens = exactId ? [] : queryText.split(' ').filter(Boolean);
  const selections = {
    category: selectedKeys(category), media: selectedKeys(media),
    genre: selectedKeys(genre), evidence: selectedKeys(evidence),
  };
  const bookmarkedIds = new Set(values(bookmarks).map(idKey));

  return prepared.records.filter(record => {
    if (exactId && record.id !== exactId) return false;
    if (bookmarkedOnly && (!record.id || !bookmarkedIds.has(record.id))) return false;
    if (!matchesFacet(record.categoryKeys, selections.category)) return false;
    if (!matchesFacet(record.mediaKeys, selections.media)) return false;
    if (!matchesFacet(record.genreKeys, selections.genre)) return false;
    if (!matchesFacet(record.evidenceKeys, selections.evidence)) return false;
    return tokens.every(token => /^sf[-_]?\d{1,9}$/u.test(token)
      ? record.id === idKey(token)
      : record.text.includes(token));
  }).map(record => record.entry);
}

function addCount(map, value, label = value) {
  const key = normalizeText(value);
  if (!key) return;
  if (!map.has(key)) map.set(key, { value: String(value), label: String(label), count: 0 });
  map.get(key).count += 1;
}

function counts(map, numeric = false) {
  return Array.from(map.values()).sort((a, b) => {
    if (numeric && Number.isFinite(Number(a.value)) && Number.isFinite(Number(b.value))) {
      return Number(a.value) - Number(b.value);
    }
    return b.count - a.count || a.label.localeCompare(b.label, 'zh-CN');
  });
}

function sourceUrls(entry, primaryOnly = false) {
  return Object.entries(entry)
    .filter(([key]) => primaryOnly ? key === 'source_url' : /(?:^|_)source_urls?$/u.test(key))
    .flatMap(([, value]) => values(value))
    .filter(value => /^https?:\/\//iu.test(value));
}

/**
 * Recompute all counts from the supplied subset, never from payload metadata.
 * totalWorks counts normalized source-title labels, preferring work_en over work_zh.
 * A label can describe a series, an episode or multiple books: it is not a
 * bibliographic claim about the number of independent creative works.
 * Genre counts are non-exclusive because an entry can have several tags.
 */
export function getStats(entries = []) {
  requireEntries(entries);
  const categories = new Map();
  const media = new Map();
  const genres = new Map();
  const evidence = new Map();
  const works = new Set();
  const sources = new Set();
  const primarySources = new Set();

  for (const entry of entries) {
    const categoryLabel = textValue(entry.category).trim() || '未分类';
    const categoryValue = entry.category_no == null || entry.category_no === '' ? categoryLabel : entry.category_no;
    addCount(categories, categoryValue, categoryLabel);
    const mediaLabels = values(entry.medium).length ? values(entry.medium) : values(entry.media);
    for (const label of new Map(mediaLabels.map(label => [normalizeText(label), label])).values()) addCount(media, label);
    for (const label of new Map(genreLabels(entry).map(label => [normalizeText(label), label])).values()) addCount(genres, label);
    addCount(evidence, evidenceLabel(entry));
    const work = normalizeText(entry.work_en) || normalizeText(entry.work_zh);
    if (work) works.add(work);
    for (const url of sourceUrls(entry)) sources.add(url);
    for (const url of sourceUrls(entry, true)) primarySources.add(url);
  }

  return {
    totalEntries: entries.length,
    totalWorks: works.size,
    workCountBasis: 'normalized-source-title-labels',
    totalCategories: categories.size,
    totalMedia: media.size,
    totalGenres: genres.size,
    totalSources: sources.size,
    totalPrimarySources: primarySources.size,
    categories: counts(categories, true),
    media: counts(media),
    genres: counts(genres),
    evidence: counts(evidence),
  };
}

/** Explicit links in both directions precede category/tag recommendations. */
export function getRelated(entry, entries, limit = 6) {
  requireEntries(entries);
  if (!entry) return [];
  const numericLimit = Number(limit);
  const maximum = Number.isFinite(numericLimit) ? Math.max(0, Math.floor(numericLimit)) : 6;
  if (!maximum) return [];
  const originId = idKey(entry.id);
  const index = buildIndex(entries);
  const result = [];
  const seenIds = new Set(originId ? [originId] : []);
  const seenObjects = new Set([entry]);

  function append(candidate) {
    if (!candidate || result.length >= maximum || seenObjects.has(candidate)) return;
    const candidateId = idKey(candidate.id);
    if (candidateId && seenIds.has(candidateId)) return;
    seenObjects.add(candidate);
    if (candidateId) seenIds.add(candidateId);
    result.push(candidate);
  }

  for (const relatedId of values(entry.related_ids)) append(index.byId.get(idKey(relatedId)));
  if (originId) {
    for (const candidate of entries) {
      if (values(candidate.related_ids).some(relatedId => idKey(relatedId) === originId)) append(candidate);
    }
  }

  const origin = makeRecord(entry, -1);
  const recommendations = index.records.map(record => {
    const sameCategory = Array.from(record.categoryKeys).some(key => origin.categoryKeys.has(key));
    const sharedGenres = Array.from(record.genreKeys).filter(key => origin.genreKeys.has(key)).length;
    return { ...record, score: (sameCategory ? 100 : 0) + sharedGenres };
  }).filter(record => record.score > 0).sort((a, b) => b.score - a.score || a.order - b.order);
  for (const record of recommendations) append(record.entry);
  return result;
}
