export function escapeHTML(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function safeUrl(value) {
  try { const url = new URL(String(value)); return ['https:','http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

export function cleanWorkTitle(value = '') {
  return String(value).replace(/^《([^》]+)》$/, '$1');
}

export function isThemeEvidence(entry) {
  return String(entry.evidence_level || entry.evidence || '').startsWith('主题支持');
}

export function icon(name, size = 20) {
  const paths = {
    bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    'bookmark-filled': '<path d="M6 3h12v18l-6-4-6 4V3Z" fill="currentColor"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M6 18 18 6M6 6h12v12"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    link: '<path d="m10 13 4-2M9 7l-2 1a5 5 0 0 0 5 9l2-1M15 17l2-1a5 5 0 0 0-5-9l-2 1"/>',
    previous: '<path d="m14 6-6 6 6 6"/>',
    next: '<path d="m10 6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  };
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.arrow}</svg>`;
}

export function sourceLinks(entry) {
  const links = [], seen = new Set();
  for (const [key,label] of [['source_url',entry.source_title || '主要来源'],['additional_source_url','补充资料'],['title_source_url','题名资料'],['constraint_source_url','边界说明来源']]) {
    const values = Array.isArray(entry[key]) ? entry[key] : [entry[key]];
    for (const value of values) {
      const url = safeUrl(value);
      if (url && !seen.has(url)) { seen.add(url); links.push({url,label,domain:new URL(url).hostname.replace(/^www\./,'')}); }
    }
  }
  return links;
}
