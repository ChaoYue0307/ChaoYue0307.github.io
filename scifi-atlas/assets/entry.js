import { STORAGE_KEY, readBookmarks, mutateBookmarks } from './bookmark-store.js';
import { icon } from './ui.js';

const id = document.body.dataset.entryId;
const actionArea = document.querySelector('[data-entry-actions]');
const bookmark = actionArea?.querySelector('[data-action="bookmark"]');
const share = actionArea?.querySelector('[data-action="share"]');
const toast = document.querySelector('#toast');
let saved = new Set();
let storageAvailable = true;
let timer;

function announce(message) {
  if (!toast) return;
  clearTimeout(timer);
  toast.querySelector('#toast-text').textContent = message;
  toast.hidden = false;
  timer = setTimeout(() => { toast.hidden = true; }, 7000);
}

function update() {
  if (!bookmark) return;
  const active = saved.has(id);
  bookmark.setAttribute('aria-pressed', String(active));
  bookmark.classList.toggle('is-saved', active);
  bookmark.setAttribute('aria-label', active ? '取消收藏这条创意' : '收藏这条创意');
  const svg = bookmark.querySelector('svg');
  if (svg) svg.outerHTML = icon(active ? 'bookmark-filled' : 'bookmark');
  const text = bookmark.querySelector('.bookmark-text');
  if (text) text.textContent = active ? '已收藏' : '收藏';
}

if (/^SF\d{3,9}$/.test(id || '') && actionArea && bookmark) {
  const initial = readBookmarks();
  saved = new Set(initial.ids);
  storageAvailable = initial.available;
  update();
  actionArea.hidden = false;
  bookmark.addEventListener('click', () => {
    const active = !saved.has(id);
    const result = mutateBookmarks(ids => active ? ids.add(id) : ids.delete(id), { fallback: saved, useFallback: !storageAvailable });
    saved = new Set(result.ids);
    storageAvailable = result.available;
    update();
    announce(result.available ? (active ? '已加入收藏，可在交互目录的“我的收藏”中查看' : '已取消收藏') : '已更新本页临时收藏；离开页面后可能丢失，可复制条目链接保留。');
  });
  share?.addEventListener('click', async () => {
    const url = document.querySelector('link[rel="canonical"]')?.href || location.href;
    try {
      await navigator.clipboard.writeText(url);
      announce('条目链接已复制');
    } catch {
      let fallback = document.querySelector('.share-fallback');
      if (!fallback) {
        fallback = document.createElement('div');
        fallback.className = 'share-fallback';
        const label = document.createElement('label'); label.htmlFor = 'share-url'; label.textContent = '复制这个链接，分享此条创意';
        const input = document.createElement('input'); input.id = 'share-url'; input.type = 'url'; input.readOnly = true;
        fallback.append(label, input); actionArea.after(fallback);
      }
      const input = fallback.querySelector('input'); input.value = url; input.focus(); input.select();
      announce('可从文本框手动复制链接');
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (!storageAvailable) return;
    const result = readBookmarks({ fallback: saved });
    saved = new Set(result.ids); storageAvailable = result.available; update();
  });
}
