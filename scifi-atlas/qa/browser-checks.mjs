/**
 * Real-browser regression checks for the archive refinement.
 * Run after starting a server: ATLAS_TEST_URL=http://127.0.0.1:4173/scifi-atlas/ npm run test:browser
 * Uses only playwright, axe-core and Node built-ins; no local browser is started by a syntax check.
 * Screenshots are review artifacts, not brittle pixel snapshots. Failures preserve a report and exit nonzero.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const base = new URL(process.env.ATLAS_TEST_URL || 'http://127.0.0.1:4173/scifi-atlas/');
base.hash = ''; base.search = '';
if (!base.pathname.endsWith('/')) base.pathname += '/';
const output = path.resolve(process.env.ATLAS_TEST_OUTPUT || 'qa-output');
const timeout = 15000;
const storageKey = 'scifi-atlas.bookmarks.v1';
const started = performance.now();
const report = {
  started_at: new Date().toISOString(), base_url: base.href,
  steps: [], runtime_issues: [], artifacts: [], accessibility: [], browsers: {},
  notes: [
    'Application, viewport and no-JavaScript checks keep CSP enforcement enabled.',
    'WebKit screenshot artifacts are omitted because Playwright 1.65.1 injects an inline body {} stylesheet during screenshot preparation, even with animations allowed and the initial caret. WebKit functional, layout, target-size and CSP checks still run unchanged; Chromium screenshots remain enabled. Source: https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/server/screenshotter.ts',
    'axe runs in a separate CSP-bypass context solely to inject its local test engine; it does not change the shipped policy.',
    'Automated checks and screenshots complement manual reading and assistive-technology review.',
  ],
};
const contexts = new Set();
const browsers = new Map();
const issueKeys = new Set();
let catalogue = [], axeSource = '', browserTypes;

function slug(value) { return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, ''); }
function localUrl(relative = '') { return new URL(relative, base).href; }
function round(value) { return Number(value.toFixed(4)); }
function errorInfo(error) { return { name: error?.name || 'Error', message: String(error?.message || error), stack: error?.stack }; }

async function checkpoint() {
  report.summary = {
    passed: report.steps.filter(step => step.status === 'passed').length,
    failed: report.steps.filter(step => step.status === 'failed').length,
    runtime_issues: report.runtime_issues.length,
    elapsed_ms: round(performance.now() - started),
  };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}

async function screenshot(page, name) {
  // Playwright 1.65.1 inPagePrepareForScreenshots injects a body {} stylesheet when WebKit syncAnimations is true.
  // Source: https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/server/screenshotter.ts
  // Skip only this artifact operation; all WebKit checks and the actual CSP violation monitors remain active.
  if (page.context().browser().browserType().name() === 'webkit') {
    report.artifacts.push({
      type: 'screenshot-note', name, browser: 'webkit', url: page.url(),
      reason: 'WebKit screenshot omitted to avoid Playwright injecting an inline stylesheet blocked by the unchanged production CSP. All functional, layout, target-size and CSP checks still run.',
      source_url: 'https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/server/screenshotter.ts',
    });
    return null;
  }
  const relative = `screens/${slug(name)}.jpg`;
  // Preserve the page's styling: screenshot overrides can inject inline CSS blocked by the real CSP.
  // Context-level reducedMotion remains enabled without adding any test stylesheet.
  await page.screenshot({ path: path.join(output, relative), type: 'jpeg', quality: 82, fullPage: false, animations: 'allow', caret: 'initial' });
  report.artifacts.push({ type: 'screenshot', name, path: relative, url: page.url() });
  return relative;
}

async function check(name, page, fn) {
  const beginning = performance.now();
  const result = { name, status: 'passed' };
  try {
    const details = await fn();
    if (details !== undefined) result.details = details;
  } catch (error) {
    result.status = 'failed'; result.error = errorInfo(error);
    if (page && !page.isClosed()) {
      try { result.screenshot = await screenshot(page, `failure-${name}`); }
      catch (captureError) { result.capture_error = String(captureError.message); }
    }
  }
  result.duration_ms = round(performance.now() - beginning);
  report.steps.push(result);
  console.log(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${name}${result.error ? `: ${result.error.message}` : ''}`);
  await checkpoint();
  return result.status === 'passed';
}

function recordIssue(label, kind, details) {
  const key = `${label}|${kind}|${details.url || ''}|${details.message || details.directive || ''}`;
  if (issueKeys.has(key)) return;
  issueKeys.add(key);
  report.runtime_issues.push({ context: label, kind, ...details });
}

async function makeContext(browser, label, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce',
    acceptDownloads: true, bypassCSP: false, ...options,
  });
  contexts.add(context);
  context.setDefaultTimeout(timeout);
  context.setDefaultNavigationTimeout(45000);
  context.on('page', page => {
    page.on('pageerror', error => recordIssue(label, 'pageerror', { url: page.url(), ...errorInfo(error) }));
    page.on('console', message => {
      if (message.type() === 'error' || /content security policy|refused to (?:execute|load|apply|connect)/i.test(message.text())) {
        recordIssue(label, 'console', { url: page.url(), message: message.text(), location: message.location() });
      }
    });
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === base.origin) {
        recordIssue(label, 'http', { url: response.url(), message: `HTTP ${response.status()}` });
      }
    });
    page.on('requestfailed', request => {
      const message = request.failure()?.errorText || 'Request failed';
      // Navigation and native downloads can cancel a previous request without an application fault.
      if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancelled|canceled/i.test(message)) {
        recordIssue(label, 'network', { url: request.url(), message });
      }
    });
  });
  if (options.javaScriptEnabled !== false && !options.bypassCSP) {
    await context.exposeBinding('__atlasQaCspViolation', ({ page }, value) => {
      recordIssue(label, 'csp', { url: page.url(), ...value });
    });
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', event => {
        window.__atlasQaCspViolation({ directive: event.effectiveDirective, blocked_uri: event.blockedURI, message: `${event.effectiveDirective}: ${event.blockedURI}` });
      });
    });
  }
  return context;
}

async function closeContext(context) { await context.close(); contexts.delete(context); }

async function gotoPage(page, relative = '') {
  const destination = localUrl(relative);
  const response = await page.goto(destination, { waitUntil: 'domcontentloaded' });
  if (response) assert.ok(response.ok(), `Navigation failed: ${relative} (${response.status()})`);
  else assert.equal(page.url(), destination, `Same-document navigation did not reach ${destination}`);
  await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
  return response;
}

async function gotoApp(page, hash = '#/explore') {
  await gotoPage(page, hash);
  await page.locator('body.app-ready').waitFor();
}

async function resultIds(page) { return page.locator('#results .idea-row').evaluateAll(rows => rows.map(row => row.dataset.entry)); }

async function waitQuery(page, query) {
  await page.waitForFunction(value => {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    return (params.get('q') || '') === value && document.querySelector('#results')?.getAttribute('aria-busy') === 'false';
  }, query);
}

async function search(page, query) {
  await page.locator('#search').fill(query);
  await page.locator('#search').press('Enter');
  await waitQuery(page, query.trim());
}

async function waitFacet(page, key, value) {
  await page.waitForFunction(({ key, value }) => (new URLSearchParams(location.hash.split('?')[1] || '').get(key) || '') === value, { key, value });
}

async function allResultIds(page) {
  const ids = [];
  for (let count = 0; count < 30; count++) {
    ids.push(...await resultIds(page));
    const next = page.locator('#pagination .page-next');
    if (!await next.isVisible() || await next.isDisabled()) return ids;
    const target = await next.getAttribute('data-page');
    await next.click();
    await page.waitForFunction(value => document.querySelector('#pagination [aria-current="page"]')?.dataset.page === value, target);
  }
  assert.fail('Pagination did not terminate within the bounded catalogue size.');
}

async function openModal(page, id) {
  const link = page.locator(`#results [data-entry="${id}"] .idea-title a`);
  const href = await link.getAttribute('href');
  assert.match(new URL(href, page.url()).pathname, new RegExp(`/ideas/${id}/$`), 'Record title must retain a usable ordinary URL.');
  await link.click();
  await page.locator('#idea-dialog[open]').waitFor();
  await page.waitForFunction(value => location.hash === `#/idea/${value}`, id);
  assert.equal(new URL(page.url()).pathname, base.pathname, 'Ordinary in-app click should open the modal, not navigate away.');
  assert.equal((await page.locator('#detail-title').textContent()).trim(), catalogue.find(entry => entry.id === id).idea);
}

async function noOverflow(page, label) {
  const measurements = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const width = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const containers = [...document.querySelectorAll('.idea-dialog[open], .topic-rail, .filter-row, .detail-toolbar, .static-entry-toolbar')]
      .filter(element => element.getClientRects().length)
      .map(element => ({ element: element.id || element.className, client: element.clientWidth, scroll: element.scrollWidth }))
      .filter(item => item.client && item.scroll > item.client + 2);
    const offenders = [...document.querySelectorAll('body *')].filter(element => {
      if (!element.getClientRects().length || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && rect.width > 1 && (rect.right > viewport + 2 || rect.left < -2);
    }).slice(0, 12).map(element => ({
      element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}.${String(element.getAttribute('class') || '').trim().replace(/\s+/g, '.')}`,
      left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
    }));
    return { viewport, width, containers, offenders };
  });
  assert.ok(measurements.width <= measurements.viewport + 2 && measurements.containers.length === 0, `${label}: horizontal overflow ${JSON.stringify(measurements)}`);
  return measurements;
}

async function usableTargets(page, selector) {
  const small = await page.locator(selector).evaluateAll(elements => elements.filter(element => element.getClientRects().length && !element.closest('[hidden]')).map(element => {
    const rect = element.getBoundingClientRect();
    return { element: element.id || element.getAttribute('aria-label') || element.className, width: rect.width, height: rect.height };
  }).filter(rect => rect.width < 43.5 || rect.height < 43.5));
  assert.deepEqual(small, [], `Interactive targets smaller than 44px: ${JSON.stringify(small)}`);
}

async function storedIds(page) {
  return page.evaluate(key => [...new Set(JSON.parse(localStorage.getItem(key) || '[]'))].sort(), storageKey);
}

async function waitStored(page, expected) {
  await page.waitForFunction(({ key, expected }) => {
    try { return JSON.stringify([...new Set(JSON.parse(localStorage.getItem(key) || '[]'))].sort()) === JSON.stringify(expected); }
    catch { return false; }
  }, { key: storageKey, expected: [...expected].sort() });
}

async function download(page, link, label) {
  const [item] = await Promise.all([page.waitForEvent('download'), link.click()]);
  assert.equal(await item.failure(), null, `Download failed: ${label}`);
  const name = `${slug(label)}-${path.basename(item.suggestedFilename())}`;
  const relative = `downloads/${name}`;
  await item.saveAs(path.join(output, relative));
  report.artifacts.push({ type: 'download', name: label, path: relative });
  return readFile(path.join(output, relative));
}

async function importFile(page, contents, name = 'qa-reading-list.json') {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#import-saved').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(contents) });
}

async function viewportChecks(browser, engine, width, height) {
  const label = `${engine}-${width}`;
  const context = await makeContext(browser, label, { viewport: { width, height }, isMobile: width <= 390, hasTouch: width <= 768 });
  const page = await context.newPage();
  const ready = await check(`${label}-homepage`, page, async () => {
    await gotoApp(page);
    assert.equal(await page.locator('#results .idea-row').count(), 24);
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    assert.ok(policy?.includes('script-src'), 'The shipped CSP meta policy is missing.');
    const metrics = await noOverflow(page, 'Homepage');
    await usableTargets(page, '.main-nav a, .hero-actions .button, .orbit-node');
    if (width === 1440 || (engine === 'chromium' && width === 390)) await screenshot(page, `${label}-homepage`);
    return metrics;
  });
  if (ready) {
    await check(`${label}-catalogue-and-long-options`, page, async () => {
      await page.locator('#start-explore').click();
      await page.waitForFunction(() => document.querySelector('#search').getBoundingClientRect().top < innerHeight / 2);
      if (width <= 1024) {
        await page.locator('#evidence-filter').selectOption('主题支持');
        await waitFacet(page, 'evidence', '主题支持');
      }
      await noOverflow(page, 'Catalogue and filter labels');
      await usableTargets(page, '#search, #media-filter, #genre-filter, #evidence-filter, #topic-select, #clear-filters, #results .bookmark-button, .filter-chip');
      const premiseSize = await page.locator('#results .idea-premise').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      assert.ok(premiseSize >= 15, `Archive prose is too small: ${premiseSize}px`);
      await screenshot(page, `${label}-catalogue`);
      await gotoApp(page, '#/explore?page=5');
      await page.locator('#pagination').scrollIntoViewIfNeeded();
      await noOverflow(page, 'Middle pagination with two ellipses');
      await usableTargets(page, '#pagination button');
    });
    await check(`${label}-dialogue`, page, async () => {
      await gotoApp(page);
      await search(page, 'SF019');
      await openModal(page, 'SF019');
      await noOverflow(page, 'Detail dialog');
      await usableTargets(page, '#idea-dialog .action-button');
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'detail-title');
      if (width === 1440 || width === 320 || engine === 'webkit') await screenshot(page, `${label}-dialogue`);
      await page.keyboard.press('Escape');
      await page.locator('#idea-dialog').waitFor({ state: 'hidden' });
    });
    await check(`${label}-standalone-detail`, page, async () => {
      await gotoPage(page, 'ideas/SF019/');
      await page.locator('[data-entry-actions]:not([hidden])').waitFor();
      assert.equal(await page.locator('body').getAttribute('data-entry-id'), 'SF019');
      assert.ok(await page.locator('.detail-source').count());
      await noOverflow(page, 'Standalone detail');
      await usableTargets(page, '.static-entry-toolbar .action-button');
      if (width === 390) await screenshot(page, `${label}-standalone-detail`);
    });
  }
  await closeContext(context);
}

async function searchAndHistory(browser, engine = 'chromium') {
  const context = await makeContext(browser, `${engine}-behaviour`, engine === 'webkit' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  const page = await context.newPage();
  await check(`${engine}-search-exact-id-and-words`, page, async () => {
    await gotoApp(page);
    for (const query of ['SF019', 'SF 019 cyberspace']) {
      await search(page, query);
      assert.deepEqual(await resultIds(page), ['SF019']);
    }
    await search(page, 'SF 019 definitely-no-such-term-qa');
    assert.deepEqual(await resultIds(page), []);
    assert.ok(await page.locator('#empty-state').isVisible());
    await page.locator('#search-clear').click();
    await waitQuery(page, '');
    assert.equal(await page.locator('#results .idea-row').count(), 24);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'search');
    await search(page, 'AI');
    const found = await allResultIds(page);
    assert.ok(found.length, 'AI search unexpectedly returned no records.');
    assert.ok(!found.includes('SF167'), 'AI must not match the substring in D-Mail.');
  });
  await check(`${engine}-combined-filters-pagination-and-history`, page, async () => {
    await gotoApp(page);
    await page.locator('#media-filter').selectOption('文学');
    await waitFacet(page, 'media', '文学');
    await page.locator('#evidence-filter').selectOption('直接支持');
    await waitFacet(page, 'evidence', '直接支持');
    if (await page.locator('#topic-select').isVisible()) await page.locator('#topic-select').selectOption('4');
    else await page.locator('#topic-nav [data-topic="4"]').click();
    await waitFacet(page, 'topic', '4');
    const expected = catalogue.filter(entry => Number(entry.category_no) === 4 && entry.media === '文学' && String(entry.evidence_level || entry.evidence).startsWith('直接支持')).map(entry => entry.id).sort();
    assert.deepEqual((await resultIds(page)).sort(), expected);
    await page.locator('#clear-filters').click();
    await waitFacet(page, 'topic', '');
    await page.locator('#media-filter').selectOption('文学');
    await waitFacet(page, 'media', '文学');
    await page.locator('#pagination .page-button[data-page="2"]:not(.page-previous):not(.page-next)').click();
    await page.waitForFunction(() => document.querySelector('#pagination [aria-current="page"]')?.dataset.page === '2');
    const ids = await resultIds(page), before = page.url();
    assert.equal(ids.length, 24);
    await openModal(page, ids[0]);
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.querySelector('#idea-dialog')?.contains(document.activeElement)), 'Keyboard focus escaped the modal.');
    }
    await page.goBack();
    await page.locator('#idea-dialog').waitFor({ state: 'hidden' });
    assert.equal(page.url(), before);
    assert.deepEqual(await resultIds(page), ids);
    assert.equal(await page.locator('#media-filter').inputValue(), '文学');
    assert.equal(await page.locator('#pagination [aria-current="page"]').getAttribute('data-page'), '2');
    await page.goForward();
    await page.locator('#idea-dialog[open]').waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('body.app-ready').waitFor();
    await page.locator('#idea-dialog[open]').waitFor();
    assert.equal((await page.locator('#detail-title').textContent()).trim(), catalogue.find(entry => entry.id === ids[0]).idea);
  });
  await closeContext(context);
}

async function collectionChecks(browser) {
  const context = await makeContext(browser, 'chromium-collections');
  const page = await context.newPage(), other = await context.newPage();
  await check('collections-persist-and-sync-between-tabs', page, async () => {
    await gotoApp(page, '#/saved');
    await gotoPage(other, 'ideas/SF019/');
    const externalBookmark = other.locator('[data-entry-actions] [data-action="bookmark"]');
    await externalBookmark.waitFor();
    await externalBookmark.click();
    await page.locator('#results [data-entry="SF019"]').waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('body.app-ready').waitFor();
    assert.deepEqual(await resultIds(page), ['SF019']);
    await page.locator('#results [data-id="SF019"][data-action="bookmark"]').click();
    await other.waitForFunction(() => document.querySelector('[data-entry-actions] [data-action="bookmark"]')?.getAttribute('aria-pressed') === 'false');
    await waitStored(page, []);
  });
  await check('collections-safe-import-merge-export-and-undo', page, async () => {
    await gotoApp(page);
    await search(page, 'SF001');
    await page.locator('#results [data-action="bookmark"][data-id="SF001"]').click();
    await waitStored(page, ['SF001']);
    await page.locator('[data-nav="saved"]').click();
    await page.locator('#import-saved').waitFor();
    const payload = JSON.stringify({
      title: 'QA imported collection', ['__proto__']: { __atlasQaPolluted: true },
      entries: [
        { id: 'SF019', idea: '<img id="qa-import-payload" src=x onerror="window.__atlasQaImportExecuted=true">', source_url: 'javascript:window.__atlasQaImportExecuted=true' },
        { id: 'sf019', idea: 'duplicate must be ignored' }, { id: 'SF 121' }, { id: 'SF001' },
        { id: 'SF99999999' }, { id: '<svg onload=alert(1)>' }, null,
      ],
    });
    await importFile(page, payload);
    await waitStored(page, ['SF001', 'SF019', 'SF121']);
    await page.locator('#toast-undo').waitFor();
    assert.equal((await page.locator('#results [data-entry="SF019"] .idea-title').textContent()).trim(), catalogue.find(entry => entry.id === 'SF019').idea);
    assert.equal(await page.locator('#qa-import-payload').count(), 0);
    assert.deepEqual(await page.evaluate(() => [Boolean(window.__atlasQaImportExecuted), Boolean(Object.prototype.__atlasQaPolluted)]), [false, false]);
    await page.locator('#toast-undo').click();
    await waitStored(page, ['SF001']);
    assert.deepEqual(await resultIds(page), ['SF001']);
    await importFile(page, payload);
    await waitStored(page, ['SF001', 'SF019', 'SF121']);
    const saved = JSON.parse((await download(page, page.locator('#export-saved'), 'reading-list')).toString('utf8'));
    assert.deepEqual(saved.entries.map(entry => entry.id).sort(), ['SF001', 'SF019', 'SF121']);
    assert.equal(saved.count, 3);
    assert.equal(saved.entries.find(entry => entry.id === 'SF019').idea, catalogue.find(entry => entry.id === 'SF019').idea);
    const beforeInvalid = await storedIds(page);
    const beforeInvalidToast = await page.locator('#toast-text').textContent();
    await importFile(page, '{invalid JSON', 'invalid.json');
    await page.waitForFunction(previous => !document.querySelector('#toast').hidden && document.querySelector('#toast-text').textContent !== previous && document.querySelector('#toast-undo').hidden, beforeInvalidToast);
    assert.deepEqual(await storedIds(page), beforeInvalid);
    const beforeLargeToast = await page.locator('#toast-text').textContent();
    await importFile(page, ' '.repeat(2 * 1024 * 1024 + 1), 'oversized.json');
    await page.waitForFunction(previous => !document.querySelector('#toast').hidden && document.querySelector('#toast-text').textContent !== previous && document.querySelector('#toast-undo').hidden, beforeLargeToast);
    assert.deepEqual(await storedIds(page), beforeInvalid);
  });
  await check('catalogue-json-and-excel-downloads', page, async () => {
    await gotoApp(page, '#/about');
    const json = JSON.parse((await download(page, page.locator('a[data-download="catalog"]').first(), 'catalogue')).toString('utf8'));
    const entries = Array.isArray(json) ? json : json.entries;
    assert.equal(entries.length, 240);
    assert.ok(entries.some(entry => entry.id === 'SF019'));
    const workbook = await download(page, page.locator('.download-links a[download][href$=".xlsx"]').first(), 'workbook');
    assert.ok(workbook.length > 1024 && workbook[0] === 0x50 && workbook[1] === 0x4b, 'Excel download is not a ZIP-based workbook.');
    assert.ok(workbook.includes(Buffer.from('[Content_Types].xml')) && workbook.includes(Buffer.from('xl/workbook.xml')), 'Excel archive is missing OOXML workbook entries.');
  });
  await closeContext(context);
}

async function noJavaScript(browser, engine) {
  const context = await makeContext(browser, `${engine}-no-javascript`, { javaScriptEnabled: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await check(`${engine}-complete-catalogue-without-javascript`, page, async () => {
    await gotoPage(page, 'catalog/');
    assert.equal(await page.locator('.static-index-item').count(), 240);
    assert.equal(await page.locator('.static-topic-section').count(), 20);
    const hrefs = await page.locator('.static-index-item h3 a').evaluateAll(links => links.map(link => link.getAttribute('href')));
    assert.equal(new Set(hrefs).size, 240);
    await noOverflow(page, 'No-JavaScript full catalogue');
    if (engine === 'chromium') await screenshot(page, `${engine}-no-javascript-catalogue`);
    await page.locator('.static-index-item h3 a[href*="/SF019/"]').click();
    await page.locator('#detail-title').waitFor();
    assert.equal((await page.locator('#detail-title').textContent()).trim(), catalogue.find(entry => entry.id === 'SF019').idea);
    assert.ok(await page.locator('.detail-source').count());
    assert.ok(await page.locator('[data-entry-actions]').isHidden(), 'Nonfunctional controls should stay hidden without JavaScript.');
    await noOverflow(page, 'No-JavaScript detail');
  });
  await closeContext(context);
}

async function axeScan(page, label) {
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  }));
  const relative = `axe/${slug(label)}.json`;
  await writeFile(path.join(output, relative), JSON.stringify(results, null, 2) + '\n');
  report.accessibility.push({ label, violations: results.violations.length, incomplete: results.incomplete.length, path: relative });
  assert.equal(results.violations.length, 0, `axe violations: ${results.violations.map(rule => `${rule.id} (${rule.nodes.length})`).join(', ')}; see ${relative}`);
}

async function accessibilityChecks(browser) {
  // This isolated context permits the local audit engine. Runtime/CSP checks above never bypass policy.
  const context = await makeContext(browser, 'chromium-accessibility', { bypassCSP: true });
  const page = await context.newPage();
  for (const [label, route] of [['home', '#/explore'], ['topics', '#/topics'], ['about', '#/about'], ['saved-empty', '#/saved']]) {
    await check(`axe-${label}`, page, async () => { await gotoApp(page, route); await axeScan(page, label); });
  }
  await check('axe-open-dialogue', page, async () => {
    await gotoApp(page); await search(page, 'SF019'); await openModal(page, 'SF019'); await axeScan(page, 'dialogue');
  });
  for (const [label, route] of [['standalone-detail', 'ideas/SF019/'], ['static-catalogue', 'catalog/']]) {
    await check(`axe-${label}`, page, async () => { await gotoPage(page, route); await axeScan(page, label); });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await check('axe-mobile-catalogue', page, async () => { await gotoApp(page); await page.locator('#catalog').scrollIntoViewIfNeeded(); await axeScan(page, 'mobile-catalogue'); });
  await closeContext(context);
}

async function main() {
  await Promise.all(['screens', 'downloads', 'axe'].map(dir => mkdir(path.join(output, dir), { recursive: true })));
  const playwright = await import('playwright');
  browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
  const axeModule = await import('axe-core');
  axeSource = (axeModule.default || axeModule).source;
  const api = await playwright.request.newContext({ timeout: 30000 });
  const dataReady = await check('catalogue-data-contract', null, async () => {
    const response = await api.get(localUrl('data/catalog.json'));
    assert.ok(response.ok(), `Catalogue HTTP ${response.status()}`);
    const payload = await response.json(); catalogue = Array.isArray(payload) ? payload : payload.entries;
    assert.equal(catalogue.length, 240); assert.equal(new Set(catalogue.map(entry => entry.id)).size, 240);
    for (const id of ['SF001', 'SF019', 'SF121', 'SF167']) assert.ok(catalogue.some(entry => entry.id === id), `Missing fixture record ${id}`);
  });
  await api.dispose();
  if (!dataReady) return;
  for (const engine of ['chromium', 'webkit']) {
    await check(`${engine}-launch`, null, async () => {
      const browser = await browserTypes[engine].launch({ headless: true }); browsers.set(engine, browser); report.browsers[engine] = browser.version();
    });
  }
  const chromium = browsers.get('chromium');
  if (chromium) {
    for (const [width, height] of [[1440, 1000], [1024, 900], [768, 1024], [390, 844], [320, 740]]) await viewportChecks(chromium, 'chromium', width, height);
    await searchAndHistory(chromium);
    await collectionChecks(chromium);
    await noJavaScript(chromium, 'chromium');
    await accessibilityChecks(chromium);
  }
  const webkit = browsers.get('webkit');
  if (webkit) {
    await viewportChecks(webkit, 'webkit', 390, 844);
    await searchAndHistory(webkit, 'webkit');
    await noJavaScript(webkit, 'webkit');
  }
}

try { await main(); }
catch (error) {
  report.steps.push({ name: 'runner', status: 'failed', error: errorInfo(error) });
  console.error(error);
} finally {
  for (const context of contexts) {
    try { await context.close(); } catch (error) { recordIssue('cleanup', 'context-close', { message: error.message }); }
  }
  for (const [engine, browser] of browsers) {
    try { await browser.close(); } catch (error) { recordIssue(engine, 'browser-close', { message: error.message }); }
  }
  await mkdir(output, { recursive: true });
  report.finished_at = new Date().toISOString();
  await checkpoint();
  process.exitCode = report.summary.failed || report.runtime_issues.length ? 1 : 0;
  console.log(JSON.stringify({ ...report.summary, report: path.join(output, 'report.json') }));
}
