import { normalizeId } from './catalog-core.js';

function ownValue(object, key) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function validCatalogueIds(catalog) {
  const entries = Array.isArray(catalog) ? catalog : catalog?.entries;
  if (!Array.isArray(entries)) throw new TypeError('Expected catalogue entries or a catalogue index.');
  const ids = new Set();
  for (const entry of entries) {
    const raw = ownValue(entry, 'id');
    const id = normalizeId(raw);
    if (id && raw === id) ids.add(id);
  }
  return ids;
}

function existingIds(bookmarks, known) {
  const input = Array.isArray(bookmarks) || bookmarks instanceof Set ? Array.from(bookmarks) : [];
  return [...new Set(input.map(normalizeId).filter(id => id && known.has(id)))];
}

/**
 * Parse a site export ({ entries: [{ id, ... }] }) or an array of ID strings.
 * Only own, non-accessor ID properties are read; imported record content is ignored.
 * The result is a merge proposal. This function never writes storage or mutates inputs.
 * Whole-file errors keep the normalized existing collection unchanged in mergedIds.
 */
export function parseReadingList(input, catalog, { bookmarks = [] } = {}) {
  const known = validCatalogueIds(catalog);
  const existing = existingIds(bookmarks, known);
  const result = {
    ok: false,
    format: 'unknown',
    ids: [],
    mergedIds: existing.slice(),
    addedIds: [],
    alreadySavedIds: [],
    invalid: [],
    unknown: [],
    duplicates: [],
    errors: [],
    totalItems: 0,
  };

  let payload = input;
  if (typeof input === 'string') {
    const source = input.replace(/^\uFEFF/u, '').trim();
    if (!source) {
      result.errors.push({ code: 'empty-input', message: '阅读清单为空。' });
      return result;
    }
    try { payload = JSON.parse(source); }
    catch {
      result.errors.push({ code: 'invalid-json', message: '文件不是有效的 JSON 阅读清单。' });
      return result;
    }
  }

  const exported = ownValue(payload, 'entries');
  const items = Array.isArray(payload) ? payload : exported;
  if (!Array.isArray(items)) {
    result.errors.push({ code: 'unsupported-format', message: '请选择本站导出的阅读清单，或包含 SF 编号的 JSON 数组。' });
    return result;
  }
  result.format = Array.isArray(payload) ? 'id-array' : 'site-export';
  result.totalItems = items.length;
  const seen = new Set();
  const existingSet = new Set(existing);

  for (let index = 0; index < items.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(items, String(index));
    const item = descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
    const raw = result.format === 'site-export' ? ownValue(item, 'id') : item;
    const id = normalizeId(raw);
    if (!id) {
      result.invalid.push({ index, reason: result.format === 'site-export' && raw === undefined ? 'invalid-entry' : 'invalid-id' });
      continue;
    }
    if (!known.has(id)) {
      result.unknown.push({ index, id });
      continue;
    }
    if (seen.has(id)) {
      result.duplicates.push({ index, id });
      continue;
    }
    seen.add(id);
    result.ids.push(id);
    if (existingSet.has(id)) result.alreadySavedIds.push(id);
    else result.addedIds.push(id);
  }

  result.mergedIds.push(...result.addedIds);
  result.ok = true;
  return result;
}
