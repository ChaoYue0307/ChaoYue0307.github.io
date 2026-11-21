import { buildIndex, filterEntries, getStats, getRelated } from './catalog-core.js';
import { escapeHTML as esc, icon, isThemeEvidence } from './ui.js';
import { renderDetail } from './detail-view.js';

const PAGE_SIZE = 24;
const STORAGE_KEY = 'scifi-atlas.bookmarks.v1';
const TITLE = '科幻创意图谱 · Sci-Fi Atlas';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const baseState = () => ({ view: 'explore', query: '', category: '', media: '', genre: '', evidence: '', page: 1 });
const topicDescriptions = [
  '当机器开始判断、学习与行动。', '一个“我”可以被复制、分割或迁移吗？',
  '如果记忆可以编辑，经历还属于谁？', '怎样确认自己身处的世界是真实的？',
  '语言、信息与知识如何改变我们。', '跨越距离，也跨越人的时间尺度。',
  '把星球、恒星与轨道变成工程材料。', '从新的能源到物质的重新组织。',
  '改变过去、预见未来，或走进另一个可能。', '当熟悉的物理规律不再适用。',
  '生命从自然产物变成可设计的系统。', '身体、出生与死亡还能怎样被安排？',
  '寻找完全不同的生命与智能。', '理解陌生者，也重新理解自己。',
  '在有限的行星上，重新学习共存。', '技术改变了谁工作、谁拥有、谁分配。',
  '当治理获得新的工具与边界。', '从个体命运看到文明的长时段。',
  '我们能发现什么，又有哪些事无法知道？', '新技术之下，重新定义关系与价值。',
];

let entries = [], index, stats, filtered = [], state = baseState();
let bookmarks = new Set(), storageAvailable = true, loaded = false;
let detailId = '', returnContext = null, lastRoute = null, lastRandomId = '';
let searchTimer, toastTimer, toastUndo = null, composing = false;
const dialog = $('#idea-dialog');

function parseRoute(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/explore';
  const [path, query = ''] = raw.split('?');
  const ideaMatch = path.match(/^\/idea\/(SF\d{1,6})$/i);
  if (ideaMatch) return { view: 'idea', id: `SF${String(Number(ideaMatch[1].slice(2))).padStart(3, '0')}` };
  const view = ['explore', 'topics', 'saved', 'about'].includes(path.slice(1)) ? path.slice(1) : 'explore';
  const params = new URLSearchParams(query);
  const page = Number(params.get('page'));
  return {
    ...baseState(), view,
    query: (params.get('q') || '').slice(0, 500),
    category: params.get('topic') || '', media: params.get('media') || '',
    genre: params.get('genre') || '', evidence: params.get('evidence') || '',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

function stateHash(next = state) {
  const params = new URLSearchParams();
  for (const [key, value] of [['q', next.query], ['topic', next.category], ['media', next.media], ['genre', next.genre], ['evidence', next.evidence]]) {
    if (value) params.set(key, value);
  }
  if (next.page > 1) params.set('page', String(next.page));
  const query = params.toString();
  return `#/${next.view}${query ? `?${query}` : ''}`;
}

function navigate(hash, { replace = false, scroll = null, historyData = {} } = {}) {
  clearTimeout(searchTimer);
  if (location.hash !== hash) {
    history[replace ? 'replaceState' : 'pushState'](historyData, '', hash);
  } else if (replace) {
    history.replaceState(historyData, '', hash);
  }
  route({ force: true, scroll });
}

function scrollToCatalog({ focus = false } = {}) {
  $('#catalog').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  if (focus) { $('#catalog-title').tabIndex = -1; $('#catalog-title').focus({ preventScroll: true }); }
}

function showToast(message, undo = null) {
  clearTimeout(toastTimer);
  (dialog.open ? dialog : document.body).append($('#toast'));
  $('#toast-text').textContent = message;
  $('#toast').hidden = false;
  $('#toast-undo').hidden = !undo;
  toastUndo = undo;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; toastUndo = null; }, undo ? 8000 : 5000);
}

function loadBookmarks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    bookmarks = new Set(Array.isArray(stored) ? stored.filter(id => index.byId.has(id)) : []);
  } catch {
    storageAvailable = false;
    bookmarks = new Set();
  }
}

function persistBookmarks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...bookmarks])); storageAvailable = true; }
  catch { storageAvailable = false; }
  renderStorageNotice();
}

function renderStorageNotice() {
  let notice = $('.storage-warning');
  if (!storageAvailable && !notice) {
    notice = document.createElement('p'); notice.className = 'storage-warning';
    notice.textContent = '当前浏览器无法持久保存收藏；本次打开期间仍可使用，请及时导出清单。';
    $('#saved-note').append(notice);
  }
  if (notice) notice.hidden = storageAvailable;
}

function updateBookmarkControls() {
  const count = $('#saved-count');
  count.textContent = bookmarks.size; count.hidden = bookmarks.size === 0;
  $$('[data-action="bookmark"]').forEach(button => {
    const id = button.dataset.id, entry = index.byId.get(id), saved = bookmarks.has(id);
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}：${entry?.idea || id}`);
    button.title = saved ? '取消收藏' : '收藏这条创意';
    const svg = button.querySelector('svg');
    if (svg) svg.outerHTML = icon(saved ? 'bookmark-filled' : 'bookmark');
    const label = button.querySelector('.bookmark-text');
    if (label) label.textContent = saved ? '已收藏' : '收藏';
  });
  $('#export-saved').disabled = bookmarks.size === 0;
}

function setBookmark(id, saved, { announce = true } = {}) {
  if (!index.byId.has(id)) return;
  const restoreListFocus = state.view === 'saved' && !dialog.open && document.activeElement?.closest('#results');
  if (saved) bookmarks.add(id); else bookmarks.delete(id);
  persistBookmarks();
  if (state.view === 'saved') renderResults();
  updateBookmarkControls();
  if (restoreListFocus) {
    const target = $('#results .bookmark-button') || $('#catalog-title');
    if (target.id === 'catalog-title') target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
  if (announce) {
    const message = storageAvailable ? (saved ? '已加入收藏' : '已从收藏移除') : '已更新本次收藏；浏览器无法持久保存，请及时导出。';
    showToast(message, () => setBookmark(id, !saved, { announce: false }));
  }
}

function rowHTML(entry) {
  const saved = bookmarks.has(entry.id), theme = isThemeEvidence(entry);
  const author = String(entry.author || '').split(/[（(]/)[0].trim();
  return `<article class="idea-row" data-entry="${esc(entry.id)}">
    <div class="row-meta"><span class="row-id">${esc(entry.id)}</span><span class="row-medium">${esc(entry.media)}</span></div>
    <div class="row-main"><h3 class="idea-title"><a href="#/idea/${esc(entry.id)}">${esc(entry.idea)}</a></h3>
      <p class="work-line"><span class="work-title">${esc(entry.work_zh)}</span>${author ? `<span class="creator">${esc(author)}</span>` : ''}</p>
      <p class="idea-premise">${esc(entry.premise)}</p></div>
    <div class="row-side"><button class="bookmark-button${saved ? ' is-saved' : ''}" data-action="bookmark" data-id="${esc(entry.id)}" aria-pressed="${saved}" aria-label="${saved ? '取消收藏' : '收藏'}：${esc(entry.idea)}">${icon(saved ? 'bookmark-filled' : 'bookmark')}</button>
      <span class="evidence-label${theme ? ' theme-support' : ''}" title="${theme ? '来源支持作品主题；机制细节仍需核对原作' : '所列资料明确涉及相应设定；不代表现实技术已实现'}">${theme ? '主题支持 · 待核对' : '直接支持'}</span></div>
  </article>`;
}

function pageSequence(page, total) {
  const pages = new Set([1, total, page - 1, page, page + 1]);
  if (page < 4) [2, 3, 4].forEach(p => pages.add(p));
  if (page > total - 3) [total - 3, total - 2, total - 1].forEach(p => pages.add(p));
  const sorted = [...pages].filter(p => p > 0 && p <= total).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => i && p - sorted[i - 1] > 1 ? ['…', p] : [p]);
}

function renderResults() {
  filtered = filterEntries(index, { ...state, bookmarkedOnly: state.view === 'saved', bookmarks });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  if (!detailId && ['explore', 'saved'].includes(state.view) && location.hash !== stateHash()) {
    history.replaceState(history.state, '', stateHash()); lastRoute = location.hash;
  }
  const start = (state.page - 1) * PAGE_SIZE;
  $('#result-count').textContent = `${filtered.length} 条创意${state.view === 'saved' ? ` · 共收藏 ${bookmarks.size} 条` : ` · 目录共 ${entries.length} 条`}`;
  $('#results').innerHTML = filtered.slice(start, start + PAGE_SIZE).map(rowHTML).join('');
  $('#results').setAttribute('aria-busy', 'false');
  $('#empty-state').hidden = filtered.length > 0;
  if (!filtered.length) {
    const noSaved = state.view === 'saved' && bookmarks.size === 0;
    $('#empty-state').innerHTML = `<span class="empty-index">${noSaved ? '待你收藏' : '尚未找到'}</span><h3>${noSaved ? '给好奇心留个位置。' : '这个组合里，还没有条目。'}</h3><p>${noSaved ? '点击条目右侧的书签，把想继续思考的设想收在这里。' : '试试更短的关键词，或减少一个筛选条件。'}</p>${noSaved ? '<a class="button button-primary" href="#/explore">去探索目录</a>' : '<button class="button button-secondary" data-action="clear">清除筛选</button>'}`;
  }
  $('#pagination').hidden = totalPages <= 1;
  $('#pagination').innerHTML = totalPages > 1 ? `<button class="page-button page-previous" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="上一页">${icon('previous')}</button>${pageSequence(state.page, totalPages).map(p => p === '…' ? '<span class="page-ellipsis" aria-hidden="true">…</span>' : `<button class="page-button${p === state.page ? ' selected' : ''}" data-page="${p}" ${p === state.page ? 'aria-current="page"' : ''} aria-label="第 ${p} 页">${p}</button>`).join('')}<button class="page-button page-next" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''} aria-label="下一页">${icon('next')}</button>` : '';
  $('#page-position').textContent = filtered.length ? `显示 ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} / ${filtered.length}` : '0 条结果';
  $$('[data-action="random"]').forEach(button => { button.disabled = filtered.length === 0; });
  renderActiveFilters();
  updateBookmarkControls();
}

function renderActiveFilters() {
  const categoryName = stats.categories.find(c => c.value === state.category)?.label || state.category;
  const chips = [
    ['query', state.query ? `搜索：${state.query}` : ''], ['category', categoryName],
    ['media', state.media], ['genre', state.genre], ['evidence', state.evidence],
  ].filter(([, value]) => value);
  $('#active-filters').hidden = chips.length === 0;
  $('#active-filters').innerHTML = chips.map(([key, label]) => `<button class="filter-chip" data-clear="${key}" aria-label="移除条件：${esc(label)}">${esc(label)}${icon('close', 14)}</button>`).join('');
  $('#clear-filters').disabled = chips.length === 0;
}

function syncControls() {
  if ($('#search').value !== state.query) $('#search').value = state.query;
  $('#media-filter').value = state.media;
  $('#genre-filter').value = state.genre;
  $('#evidence-filter').value = state.evidence;
  $('#topic-select').value = state.category;
  $$('#topic-nav [data-topic]').forEach(button => {
    const selected = button.dataset.topic === state.category;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function renderView() {
  const browsing = ['explore', 'saved'].includes(state.view);
  $('#hero').hidden = state.view !== 'explore';
  $('#stats-strip').hidden = state.view !== 'explore';
  $('#catalog').hidden = !browsing;
  $('#topics-view').hidden = state.view !== 'topics';
  $('#about-view').hidden = state.view !== 'about';
  $('#saved-note').hidden = state.view !== 'saved';
  $('#catalog-title').textContent = state.view === 'saved' ? '我的收藏' : '探索目录';
  document.body.dataset.view = state.view;
  $$('[data-nav]').forEach(link => {
    const selected = link.dataset.nav === state.view;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  document.title = state.view === 'explore' ? TITLE : `${({ saved: '我的收藏', topics: '主题索引', about: '关于目录' })[state.view]} · ${TITLE}`;
  syncControls();
  if (browsing) renderResults();
  updateBookmarkControls();
}

function openIdea(id) {
  if (!index.byId.has(id)) return;
  if (!dialog.open) {
    returnContext = { hash: stateHash(), scroll: window.scrollY, focusId: document.activeElement?.closest('[data-entry]')?.dataset.entry || null };
    history.replaceState({ ...history.state, browseScroll: returnContext.scroll }, '', location.href);
    navigate(`#/idea/${id}`, { historyData: { returnContext, inAppDetail: true } });
  } else {
    navigate(`#/idea/${id}`, { replace: true, historyData: { returnContext, inAppDetail: Boolean(history.state?.inAppDetail) } });
  }
}

function closeDetail() {
  if (!dialog.open) return;
  if (history.state?.inAppDetail) history.back();
  else navigate(returnContext?.hash || '#/explore', { replace: true, scroll: returnContext?.scroll ?? 0 });
}

function renderIdea(id) {
  const entry = index.byId.get(id);
  detailId = id;
  if (!entry) {
    $('#detail-content').innerHTML = `<div class="detail-shell"><button class="detail-close" data-action="close-detail" aria-label="关闭详情">${icon('close')}</button><h1 id="detail-title">暂未收录这个编号</h1><p>请检查链接，或回到目录寻找其他设想。</p><a class="button button-primary" href="#/explore">回到目录</a></div>`;
    document.title = `未找到条目 · ${TITLE}`;
  } else {
    $('#detail-content').innerHTML = renderDetail(entry, { related: getRelated(entry, entries, 6), bookmarked: bookmarks.has(id) });
    document.title = `${entry.idea} · ${TITLE}`;
  }
  document.body.classList.add('modal-open');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  $('#detail-content').scrollTop = 0;
  dialog.querySelector('[data-action="close-detail"]')?.focus({ preventScroll: true });
  updateBookmarkControls();
}

function route({ force = false, scroll = null } = {}) {
  if (!loaded || (!force && lastRoute === location.hash)) return;
  clearTimeout(searchTimer);
  lastRoute = location.hash;
  const next = parseRoute();
  if (next.view === 'idea') {
    detailId = next.id;
    if (!dialog.open) {
      returnContext = history.state?.returnContext || returnContext;
      if (returnContext) state = parseRoute(returnContext.hash);
      renderView();
    }
    renderIdea(next.id);
    return;
  }
  const wasDetail = Boolean(detailId), previousContext = returnContext;
  detailId = '';
  if (dialog.open) dialog.close();
  document.body.append($('#toast'));
  document.body.classList.remove('modal-open');
  state = next;
  renderView();
  if (typeof scroll === 'number') window.scrollTo({ top: scroll, behavior: 'instant' });
  else if (scroll === 'catalog') scrollToCatalog({ focus: true });
  else if (wasDetail) {
    window.scrollTo({ top: history.state?.browseScroll ?? previousContext?.scroll ?? 0, behavior: 'instant' });
    if (previousContext?.focusId) {
      const target = document.querySelector(`[data-entry="${previousContext.focusId}"] .idea-title a`) || $('#results .idea-title a') || $('#catalog-title');
      if (target.id === 'catalog-title') target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  } else if (typeof history.state?.browseScroll === 'number') window.scrollTo({ top: history.state.browseScroll, behavior: 'instant' });
  returnContext = null;
}

function updateFilters(patch = {}, { replace = false, scroll = false } = {}) {
  const next = { ...state, query: $('#search').value.trim(), ...patch, page: 1 };
  if (!['explore', 'saved'].includes(next.view)) next.view = 'explore';
  navigate(stateHash(next), { replace, scroll: scroll ? 'catalog' : null });
}

function clearFilters() {
  navigate(stateHash({ ...baseState(), view: state.view === 'saved' ? 'saved' : 'explore' }));
  $('#search').focus({ preventScroll: true });
}

function randomIdea() {
  const pool = ['explore', 'saved'].includes(state.view) ? filtered : entries;
  if (!pool.length) { showToast('当前没有可供随机浏览的条目'); return; }
  const choices = pool.length > 1 ? pool.filter(entry => entry.id !== lastRandomId && entry.id !== detailId) : pool;
  const candidates = choices.length ? choices : pool;
  const entry = candidates[Math.floor(Math.random() * candidates.length)];
  lastRandomId = entry.id; openIdea(entry.id);
}

async function shareIdea(id) {
  const url = new URL(location.href); url.hash = `/idea/${id}`;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(url.href); showToast('条目链接已复制');
  } catch {
    let fallback = dialog.querySelector('.share-fallback');
    if (!fallback) {
      fallback = document.createElement('div'); fallback.className = 'share-fallback';
      fallback.innerHTML = '<label for="share-url">复制这个链接，分享此条创意</label><input id="share-url" readonly type="url">';
      $('#detail-content').append(fallback);
    }
    const input = fallback.querySelector('input'); input.value = url.href;
    input.focus(); input.select(); showToast('可从文本框手动复制条目链接');
  }
}

function exportSaved() {
  const saved = entries.filter(entry => bookmarks.has(entry.id));
  if (!saved.length) return;
  const content = JSON.stringify({ title: '我的科幻创意收藏', exported_at: new Date().toISOString(), source: new URL('./', location.href).href, count: saved.length, entries: saved }, null, 2);
  const objectUrl = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = objectUrl;
  link.download = `SciFi_Reading_List_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  showToast(`已导出 ${saved.length} 条收藏`);
}

function populateDirectory(payload) {
  for (const [key, value] of Object.entries({ entries: stats.totalEntries, categories: stats.totalCategories, media: stats.totalMedia, sources: stats.totalSources })) {
    $$(`[data-stat="${key}"]`).forEach(el => { el.textContent = value; });
  }
  const options = (items, empty) => `<option value="">${empty}</option>${items.map(item => `<option value="${esc(item.value)}">${esc(item.label)} (${item.count})</option>`).join('')}`;
  $('#media-filter').innerHTML = options(stats.media, '全部媒介');
  $('#genre-filter').innerHTML = options(stats.genres, '全部子类型');
  $('#topic-select').innerHTML = options(stats.categories, '全部主题');
  $('#topic-nav').innerHTML = `<button class="topic-link" data-topic=""><span>全部主题</span><em>${entries.length}</em></button>${stats.categories.map(category => `<button class="topic-link" data-topic="${esc(category.value)}"><span class="topic-number">${String(category.value).padStart(2, '0')}</span><span>${esc(category.label)}</span><em>${category.count}</em></button>`).join('')}`;
  $('#topic-index').innerHTML = stats.categories.map(category => `<a class="topic-index-item" href="#/explore?topic=${esc(category.value)}"><span class="topic-index-no">${String(category.value).padStart(2, '0')}</span><div><h2 class="topic-index-title">${esc(category.label)}</h2><p class="topic-index-description">${esc(topicDescriptions[Number(category.value) - 1])}</p></div><span class="topic-index-count">${category.count} 条 ${icon('arrow')}</span></a>`).join('');
  $('#data-version').textContent = payload.version || '2026-11-21';
  $('#media-distribution').innerHTML = stats.media.map(medium => `<div class="media-distribution-row"><span>${esc(medium.label)}</span><span>${medium.count}</span></div>`).join('');
  renderStorageNotice();
}

function bindEvents() {
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const action = target.closest('[data-action]');
    if (action) {
      if (action.disabled) return;
      const kind = action.dataset.action;
      if (kind === 'bookmark') setBookmark(action.dataset.id, !bookmarks.has(action.dataset.id));
      else if (kind === 'random') randomIdea();
      else if (kind === 'close-detail') closeDetail();
      else if (kind === 'share') shareIdea(action.dataset.id);
      else if (kind === 'clear') clearFilters();
      return;
    }
    const topic = target.closest('[data-topic]');
    if (topic) { updateFilters({ category: topic.dataset.topic }, { scroll: Boolean(topic.closest('.orbit')) }); return; }
    const clear = target.closest('[data-clear]');
    if (clear) { updateFilters({ [clear.dataset.clear]: '' }); return; }
    const page = target.closest('[data-page]');
    if (page && !page.disabled) {
      navigate(stateHash({ ...state, page: Number(page.dataset.page) }), { scroll: 'catalog' }); return;
    }
    const link = target.closest('a[href^="#"]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const hash = link.getAttribute('href');
    if (hash === '#catalog') {
      event.preventDefault();
      if (!['explore', 'saved'].includes(state.view)) navigate('#/explore');
      scrollToCatalog({ focus: link.classList.contains('skip-link') }); return;
    }
    if (hash === '#top') { event.preventDefault(); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    if (!hash.startsWith('#/')) return;
    event.preventDefault();
    const idea = hash.match(/^#\/idea\/(SF\d+)$/);
    if (idea) openIdea(idea[1]);
    else navigate(hash, { scroll: hash.includes('?topic=') ? 'catalog' : 0 });
  });
  $('#search').addEventListener('compositionstart', () => { composing = true; clearTimeout(searchTimer); });
  const scheduleSearch = () => {
    if (composing) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => updateFilters({ query: $('#search').value.trim() }, { replace: true }), 180);
  };
  $('#search').addEventListener('input', scheduleSearch);
  $('#search').addEventListener('compositionend', () => { composing = false; scheduleSearch(); });
  $('#search').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !composing) { clearTimeout(searchTimer); updateFilters({ query: $('#search').value.trim() }, { replace: true }); }
  });
  for (const [selector, key] of [['#media-filter', 'media'], ['#genre-filter', 'genre'], ['#evidence-filter', 'evidence'], ['#topic-select', 'category']]) {
    $(selector).addEventListener('change', event => updateFilters({ [key]: event.target.value, query: $('#search').value.trim() }));
  }
  $('#clear-filters').addEventListener('click', clearFilters);
  $('#export-saved').addEventListener('click', exportSaved);
  $('#toast-undo').addEventListener('click', () => {
    const undo = toastUndo; clearTimeout(toastTimer); $('#toast').hidden = true; toastUndo = null;
    if (undo) undo();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDetail();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.altKey || event.metaKey || dialog.open) return;
    const target = event.target;
    if (target instanceof Element && (target.matches('input,textarea,select') || target.isContentEditable)) return;
    event.preventDefault();
    if (!['explore', 'saved'].includes(state.view)) navigate('#/explore');
    $('#search').focus();
  });
  window.addEventListener('hashchange', () => route());
  window.addEventListener('popstate', () => route());
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    loadBookmarks(); renderStorageNotice();
    if (state.view === 'saved') renderResults();
    updateBookmarkControls();
  });
}

async function init() {
  try {
    const response = await fetch(new URL('../data/catalog.json', import.meta.url));
    if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
    const payload = await response.json();
    const raw = Array.isArray(payload) ? payload : payload.entries;
    if (!Array.isArray(raw) || !raw.length) throw new Error('Catalogue is empty');
    const featured = ['SF001', 'SF008', 'SF135', 'SF201'];
    const order = entry => { const i = featured.indexOf(entry.id); return i < 0 ? featured.length : i; };
    entries = [...raw].sort((a, b) => order(a) - order(b));
    index = buildIndex(entries); stats = getStats(entries);
    loadBookmarks(); populateDirectory(payload); bindEvents();
    loaded = true; route({ force: true });
  } catch (error) {
    $('#result-count').textContent = '目录暂时无法载入';
    $('#results').setAttribute('aria-busy', 'false');
    $('#results').innerHTML = '<div class="empty-state"><h3>目录暂时没有打开。</h3><p>请刷新重试，或先下载完整目录阅读。</p><button class="button button-primary" id="retry-load">重新载入</button> <a class="text-button" href="./downloads/SF_Ideas_All_Media.xlsx" download>下载 Excel</a></div>';
    $('#retry-load').addEventListener('click', () => location.reload());
    $$('button[data-action="random"]').forEach(button => { button.disabled = true; });
    console.error('Sci-Fi Atlas could not load the catalogue.', error);
  }
}

init();
