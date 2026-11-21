import { escapeHTML, safeUrl, cleanWorkTitle, icon, sourceLinks, isThemeEvidence } from './ui.js';

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  return value == null ? '' : String(value).trim();
}

function prose(value) {
  return escapeHTML(text(value)).replace(/\r\n?|\n/g, '<br>');
}

function section(label, value, modifier = '') {
  if (!text(value)) return '';
  return `<section class="detail-section${modifier ? ` ${escapeHTML(modifier)}` : ''}">
    <h2 class="detail-label">${escapeHTML(label)}</h2>
    <p class="detail-text">${prose(value)}</p>
  </section>`;
}

function entryId(value) {
  const id = text(value).toUpperCase();
  return /^SF\d{1,9}$/.test(id) ? id : '';
}

function relatedIds(entry) {
  const values = Array.isArray(entry.related_ids) ? entry.related_ids : [entry.related_ids];
  return values.map(entryId).filter(Boolean);
}

function relationLabel(entry, candidate) {
  if (relatedIds(entry).includes(entryId(candidate.id)) || relatedIds(candidate).includes(entryId(entry.id))) {
    return '关联母题';
  }
  if (text(entry.category_no) && text(entry.category_no) === text(candidate.category_no)) return '同主题';
  return '相近子类型';
}

function renderRelated(entry, related) {
  const seen = new Set([entryId(entry.id)]);
  const items = (Array.isArray(related) ? related : []).filter(candidate => {
    if (!candidate || typeof candidate !== 'object') return false;
    const id = entryId(candidate.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (!items.length) return '';

  return `<section class="detail-section detail-related">
    <h2 class="detail-label">继续探索</h2>
    <p class="detail-text detail-related-note">关联母题与相近主题，不表示首次出处或已证实的影响关系。</p>
    <div class="detail-related-list">${items.map(candidate => {
      const id = entryId(candidate.id);
      const meta = [id, candidate.media, relationLabel(entry, candidate)].filter(Boolean).map(escapeHTML).join(' · ');
      const work = cleanWorkTitle(text(candidate.work_zh || candidate.work_en));
      return `<a class="detail-related-card" href="./ideas/${escapeHTML(id)}/" data-idea="${escapeHTML(id)}">
        <span class="detail-related-meta">${meta}</span>
        <strong class="detail-related-title">${escapeHTML(text(candidate.idea))}</strong>
        <span class="detail-related-work">${escapeHTML(work)}</span>
        ${icon('arrow', 18)}
      </a>`;
    }).join('')}</div>
  </section>`;
}

function renderSources(entry) {
  const themeEvidence = isThemeEvidence(entry);
  const evidence = text(entry.evidence);
  const evidenceLabel = themeEvidence
    ? '主题支持 · 细节待核对'
    : text(entry.evidence_level) || evidence || '未标注';
  const evidenceNote = /[（(]/u.test(evidence) ? evidence : '';
  const links = sourceLinks(entry).map(link => ({ ...link, url: safeUrl(link.url) })).filter(link => link.url);

  return `<section class="detail-section detail-evidence">
    <h2 class="detail-label">来源与核查</h2>
    <span class="badge${themeEvidence ? ' badge-theme' : ''}">${escapeHTML(evidenceLabel)}</span>
    ${evidenceNote ? `<p class="detail-text detail-evidence-note">${escapeHTML(evidenceNote)}</p>` : ''}
    <p class="detail-text detail-evidence-note">${themeEvidence
      ? '资料支持作品主题或概要，对本条具体机制的佐证有限，引用前请进一步核对原作。'
      : '来源用于核对作品中的设定。证据标签描述资料与设定的关系，不是科学真实性或技术成熟度评分。'}</p>
    ${themeEvidence ? '<p class="detail-text detail-evidence-note">证据标签不是科学真实性或技术成熟度评分。</p>' : ''}
    ${links.length ? `<ol class="detail-sources">${links.map(link => `<li>
      <a class="detail-source" href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(link.url)}" aria-label="${escapeHTML(text(link.label))}（外部资料，新窗口打开）">
        <span><strong>${escapeHTML(text(link.label))}</strong><span class="source-domain">${escapeHTML(text(link.domain))}</span></span>
        ${icon('external', 18)}
      </a>
    </li>`).join('')}</ol>` : '<p class="detail-text detail-evidence-note">此条暂无可用的来源链接。</p>'}
  </section>`;
}

/** Render one catalogue record; the caller controls the dialog and its actions. */
export function renderDetail(entry = {}, { related = [], bookmarked = false } = {}) {
  const id = text(entry.id);
  const title = text(entry.idea) || '创意详情';
  const workTitle = cleanWorkTitle(text(entry.work_zh || entry.work_en));
  const originalTitle = text(entry.work_en);
  const showOriginal = originalTitle && originalTitle !== workTitle;
  const categoryNumber = Number(entry.category_no);
  const category = `${Number.isInteger(categoryNumber) && categoryNumber > 0 ? `${String(categoryNumber).padStart(2, '0')} ` : ''}${text(entry.category)}`;
  const meta = [entry.media, category, entry.kind].map(text).filter(Boolean);
  const facts = [
    ['作者或主创', entry.author],
    ['体裁', entry.form],
    ['子类型', entry.subgenre],
    ['创意层次', entry.idea_layer],
    ...(entry.media_detail && entry.media_detail !== entry.media ? [['媒介说明', entry.media_detail]] : []),
  ].filter(([, value]) => text(value));
  const motifNotes = [...new Set([text(entry.variant_of), text(entry.shared_motif)].filter(Boolean))].join('\n');

  return `<article class="detail-shell">
    <div class="detail-toolbar">
      <button type="button" class="action-button action-button--quiet detail-close" data-action="close-detail" aria-label="关闭详情">${icon('close', 20)}<span>关闭</span></button>
      <div class="detail-actions">
        <button type="button" class="action-button bookmark-button${bookmarked ? ' is-saved' : ''}" data-action="bookmark" data-id="${escapeHTML(id)}" aria-pressed="${bookmarked ? 'true' : 'false'}" aria-label="${bookmarked ? '取消收藏这条创意' : '收藏这条创意'}">${icon(bookmarked ? 'bookmark-filled' : 'bookmark', 19)}<span class="bookmark-text">${bookmarked ? '已收藏' : '收藏'}</span></button>
        <button type="button" class="action-button action-button--quiet" data-action="share" data-id="${escapeHTML(id)}" aria-label="复制这条创意的链接">${icon('link', 19)}<span>复制链接</span></button>
      </div>
    </div>

    <header class="detail-heading">
      <p class="detail-kicker">创意档案 <span>${escapeHTML(id)}</span></p>
      <h1 id="detail-title" class="detail-title" tabindex="-1">${escapeHTML(title)}</h1>
      <div class="detail-meta">${meta.map(value => `<span class="tag">${escapeHTML(value)}</span>`).join('')}</div>
      <div class="detail-work">
        ${workTitle ? `<p class="detail-work-title"><span class="detail-work-label">代表作品</span><strong>${escapeHTML(workTitle)}</strong></p>` : ''}
        ${showOriginal ? `<p class="detail-original-title" lang="en">${escapeHTML(originalTitle)}</p>` : ''}
        ${facts.length ? `<dl class="detail-facts">${facts.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${prose(value)}</dd></div>`).join('')}</dl>` : ''}
      </div>
    </header>

    <div class="detail-body">
      ${section('一句设想', entry.premise, 'detail-premise')}
      <div class="detail-grid">
        ${section('作品中的机制', entry.mechanism)}
        ${section('启发与后果 · 整理分析', entry.implication)}
      </div>
      ${section('关键假设与边界 · 整理分析', entry.constraint, 'detail-boundary')}
      ${section('版本与改编', entry.adaptation_note)}
      ${section('关联母题说明', motifNotes)}
      ${renderSources(entry)}
      ${renderRelated(entry, related)}
    </div>
  </article>`;
}
