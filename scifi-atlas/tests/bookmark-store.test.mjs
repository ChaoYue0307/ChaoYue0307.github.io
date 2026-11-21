import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, readBookmarks, writeBookmarks, mutateBookmarks } from '../assets/bookmark-store.js';

const allowedIds = new Set(['SF001', 'SF002', 'SF003', 'SF004', 'SF005']);

function makeStorage(raw = null) {
  return {
    raw, reads: 0, writes: 0, readBlocked: false, writeBlocked: false,
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      this.reads++;
      if (this.readBlocked) throw new Error('Read blocked');
      return this.raw;
    },
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      this.writes++;
      if (this.writeBlocked) throw new Error('Write blocked');
      this.raw = value;
    },
  };
}

test('persistent writes and reads use the shared key and keep only allowed canonical IDs', () => {
  const storage = makeStorage();
  const input = ['SF001', 'SF001', 'SF999', 'sf002', 'SF2', null, {}, 'SF003'];
  const before = structuredClone(input);
  const written = writeBookmarks(input, { storage, allowedIds });
  assert.deepEqual(written, { ids: ['SF001', 'SF003'], available: true, corrupt: false });
  assert.equal(storage.raw, '["SF001","SF003"]');
  assert.deepEqual(readBookmarks({ storage, allowedIds }), written);
  assert.deepEqual(input, before);
});

test('reading filters malformed values without rewriting the stored file', () => {
  const raw = JSON.stringify(['SF003', 'SF003', 1, '<script>', 'SF999', 'SF001']);
  const storage = makeStorage(raw);
  assert.deepEqual(readBookmarks({ storage, allowedIds }), { ids: ['SF003', 'SF001'], available: true, corrupt: false });
  assert.equal(storage.raw, raw);
  assert.equal(storage.writes, 0);
  assert.deepEqual(readBookmarks({ storage }).ids, ['SF003', 'SF999', 'SF001']);
});

test('a missing key is an empty persistent collection, not an old in-memory fallback', () => {
  const storage = makeStorage();
  assert.deepEqual(readBookmarks({ storage, allowedIds, fallback: ['SF001'] }), { ids: [], available: true, corrupt: false });
});

test('invalid JSON and non-array payloads report corruption and preserve a clean fallback', () => {
  for (const raw of ['{', '', 'null', '{}', 'true', '1', '"SF001"']) {
    const storage = makeStorage(raw);
    const result = readBookmarks({ storage, allowedIds, fallback: new Set(['SF002', 'SF999']) });
    assert.deepEqual(result, { ids: ['SF002'], available: true, corrupt: true }, raw);
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
  }
});

test('blocked storage keeps usable session IDs without claiming persistence', () => {
  const storage = makeStorage('["SF001"]');
  storage.readBlocked = true;
  storage.writeBlocked = true;
  const fallback = new Set(['SF002', 'SF999']);
  assert.deepEqual(readBookmarks({ storage, allowedIds, fallback }), { ids: ['SF002'], available: false, corrupt: false });
  const result = mutateBookmarks(ids => ids.add('SF003'), { storage, allowedIds, fallback });
  assert.deepEqual(result, { ids: ['SF002', 'SF003'], available: false, corrupt: false });
  assert.deepEqual([...fallback], ['SF002', 'SF999']);
  assert.equal(storage.raw, '["SF001"]');
});

test('normal mutations merge with the latest cross-tab collection instead of a stale snapshot', () => {
  const storage = makeStorage('["SF001"]');
  const stale = new Set(readBookmarks({ storage, allowedIds }).ids);
  storage.raw = '["SF001","SF002"]';
  const added = mutateBookmarks(ids => ids.add('SF003'), { storage, allowedIds, fallback: stale });
  assert.deepEqual(added.ids, ['SF001', 'SF002', 'SF003']);

  storage.raw = '["SF002","SF003","SF005"]';
  const removed = mutateBookmarks(ids => ids.delete('SF002'), { storage, allowedIds, fallback: added.ids });
  assert.deepEqual(removed.ids, ['SF003', 'SF005']);
  assert.deepEqual(JSON.parse(storage.raw), ['SF003', 'SF005']);
  assert.deepEqual([...stale], ['SF001']);
});

test('an explicit session fallback preserves consecutive edits while writes fail and survives recovery', () => {
  const storage = makeStorage('["SF001"]');
  storage.writeBlocked = true;
  const first = mutateBookmarks(ids => ids.add('SF002'), { storage, allowedIds, fallback: ['SF001'] });
  assert.equal(first.available, false);
  assert.deepEqual(first.ids, ['SF001', 'SF002']);

  const readsBeforeSession = storage.reads;
  const second = mutateBookmarks(ids => ids.add('SF003'), { storage, allowedIds, fallback: first.ids, useFallback: true });
  const third = mutateBookmarks(ids => ids.delete('SF001'), { storage, allowedIds, fallback: second.ids, useFallback: true });
  assert.deepEqual(second.ids, ['SF001', 'SF002', 'SF003']);
  assert.deepEqual(third.ids, ['SF002', 'SF003']);
  assert.equal(third.available, false);
  assert.equal(storage.reads, readsBeforeSession);
  assert.equal(storage.raw, '["SF001"]');

  storage.writeBlocked = false;
  const recovered = mutateBookmarks(ids => ids.add('SF004'), { storage, allowedIds, fallback: third.ids, useFallback: true });
  assert.equal(recovered.available, true);
  assert.deepEqual(JSON.parse(storage.raw), ['SF002', 'SF003', 'SF004']);

  storage.raw = '["SF002","SF003","SF004","SF005"]';
  const next = mutateBookmarks(ids => ids.delete('SF003'), { storage, allowedIds, fallback: recovered.ids, useFallback: !recovered.available });
  assert.deepEqual(next.ids, ['SF002', 'SF004', 'SF005']);
});

test('successful writes can recover a corrupt collection using the supplied session fallback', () => {
  const storage = makeStorage('{');
  const result = mutateBookmarks(ids => ids.add('SF002'), { storage, allowedIds, fallback: ['SF001'] });
  assert.deepEqual(result, { ids: ['SF001', 'SF002'], available: true, corrupt: false });
  assert.deepEqual(readBookmarks({ storage, allowedIds }), result);
});
