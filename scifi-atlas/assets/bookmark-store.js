export const STORAGE_KEY = 'scifi-atlas.bookmarks.v1';

function cleanIds(values, allowedIds) {
  return [...new Set(Array.from(values || []).filter(id => typeof id === 'string' && /^SF\d{3,9}$/.test(id) && (!allowedIds || allowedIds.has(id))))];
}

export function readBookmarks({ allowedIds = null, fallback = [], storage } = {}) {
  let raw;
  try {
    const backend = storage === undefined ? window.localStorage : storage;
    raw = backend.getItem(STORAGE_KEY);
  } catch {
    return { ids: cleanIds(fallback, allowedIds), available: false, corrupt: false };
  }
  if (raw === null) return { ids: [], available: true, corrupt: false };
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) throw new TypeError('Expected saved identifiers');
    return { ids: cleanIds(value, allowedIds), available: true, corrupt: false };
  } catch {
    return { ids: cleanIds(fallback, allowedIds), available: true, corrupt: true };
  }
}

export function writeBookmarks(ids, { allowedIds = null, storage } = {}) {
  const clean = cleanIds(ids, allowedIds);
  try {
    const backend = storage === undefined ? window.localStorage : storage;
    backend.setItem(STORAGE_KEY, JSON.stringify(clean));
    return { ids: clean, available: true, corrupt: false };
  } catch {
    return { ids: clean, available: false, corrupt: false };
  }
}

export function mutateBookmarks(mutate, options = {}) {
  const current = options.useFallback === true
    ? { ids: cleanIds(options.fallback, options.allowedIds) }
    : readBookmarks(options);
  const ids = new Set(current.ids);
  mutate(ids);
  return writeBookmarks(ids, options);
}
