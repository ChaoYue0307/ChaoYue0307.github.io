"""Exercise new Global Edition without changing the preserved research tests.
Use --inline for a local render in environments where browser URL navigation is blocked.
Use --url with a real HTTP URL in CI to test assets, persistence and downloads end to end.
"""
import argparse,json,pathlib,re
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://localhost:8000/health-atlas/');ap.add_argument('--out',default='/tmp/atlas-v3-qa');ap.add_argument('--inline',action='store_true');ap.add_argument('--chromium');args=ap.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];screens=[];skipped=[]
def check(value,label):
    checks.append({'test':label,'pass':bool(value)})
    if not value:raise AssertionError(label)
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=args.chromium,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)))
    if args.inline:
        html=(root/'index.html').read_text()
        html=re.sub(r'<link rel="stylesheet"[^>]+>',lambda m:'<style>'+(root/'v3/global.css').read_text()+'</style>',html)
        html=re.sub(r'<script src="([^"]+)" defer></script>',lambda m:'<script>'+(root/m[1]).read_text().replace('</script','<\\/script')+'</script>',html)
        page.evaluate("location.hash='world?lang=zh'");page.set_content(html,wait_until='load')
    else:
        response=page.goto(args.url+'#world?lang=zh',wait_until='networkidle');check(response.status==200,'HTTP 200')
    check(page.locator('.map-countries path').count()==241,'real map geometry rendered')
    check(page.locator('h1').inner_text().startswith('从一个人'),'Chinese first view')
    check(page.locator('#covered-count').inner_text()=='209','current IDF 2024 coverage')
    for lang in ['zh','en','es','fr','pt','de','ja','ar']:
        page.select_option('#language-select',lang)
        check(page.evaluate('document.documentElement.dir')==('rtl' if lang=='ar' else 'ltr'),lang+' direction')
        for width in [1440,390]:
            page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
            for view in ['world','compare','simulator','data']:
                page.locator(f'button[data-nav={view}]').click()
                check(len(page.locator('#content').inner_text())>180,f'{lang} {width} {view}: meaningful content')
                check(not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'),f'{lang} {width} {view}: no horizontal overflow')
                if (lang=='zh' and width==1440) or (lang in ['zh','ar','en'] and width==390 and view in ['world','simulator']) or (lang=='ar' and width==1440 and view=='compare'):
                    fn=f'{view}-{lang}-{width}.png';page.screenshot(path=str(out/fn),full_page=True);screens.append(fn)
    page.set_viewport_size({'width':1440,'height':1000});page.select_option('#language-select','en');page.locator('button[data-nav=world]').click()
    page.locator('#country-search-world').fill('Brazil');page.locator('[data-search-pick=BRA]').click();check('BRA' in page.locator('.country-id').inner_text(),'country search selection')
    page.select_option('#metric-select','obesity');page.select_option('#year-select','2015')
    check('2015' in page.locator('.metric-context').inner_text(),'fixed selected year')
    check(page.locator('#measure-tag').inner_text()=='Age-standardized','standardized label')
    page.locator('#year-range').evaluate("e=>{e.value=20;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    check(page.locator('#timeline-current').inner_text()=='2020','year slider')
    page.locator('[data-zoom=in]').click();page.wait_for_timeout(220)
    check('scale(1.4)' in (page.locator('#map-stage svg > g').first.get_attribute('transform') or ''),'map zoom button')
    page.locator('[data-zoom=reset]').click()
    page.locator('[data-view=table]').click();page.locator('#table-search').fill('India')
    check(page.locator('button.country-link[data-country=IND]').count()==1,'table search')
    page.locator('#table-search').fill('Antarctica');page.locator('button.country-link[data-country=ATA]').click();check(page.locator('.main-value').inner_text()=='—','missing value not zero')
    page.locator('#country-card [data-source]').click();check(page.locator('#source-dialog').is_visible(),'source dialog opens');page.keyboard.press('Escape');check(not page.locator('#source-dialog').is_visible(),'dialog keyboard close')
    page.select_option('#metric-select','population');page.locator('[data-view=map]').click()
    check(page.locator('#map-stage circle').count()>150,'population proportional circles rather than count choropleth')
    page.locator('#theme-toggle').click();check(page.evaluate('document.documentElement.dataset.theme')=='dark','dark theme')
    page.screenshot(path=str(out/'world-en-dark.png'),full_page=True);screens.append('world-en-dark.png');page.locator('#theme-toggle').click()
    page.locator('button[data-nav=compare]').click();page.locator('[data-remove=JPN]').click();page.locator('#country-search-compare').fill('Brazil');page.locator('[data-search-pick=BRA]').click()
    check(page.locator('.country-chip').count()==4,'comparison four slots');check(page.locator('[data-remove=BRA]').count()==1,'comparison add/remove')
    page.select_option('#metric-select','diabetes_who')
    check(page.locator('#compare-bars svg path').count()>0,'uncertainty whiskers')
    page.locator('button[data-nav=simulator]').click();page.select_option('#lab-country','SGP');page.select_option('#panel-select','country')
    baseline=page.evaluate('ATLAS_LAST_RESULT.result.mean')
    page.locator('#rho-range').evaluate("e=>{e.value=.65;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    check(abs(page.evaluate('ATLAS_LAST_RESULT.result.mean')-baseline)<1e-10,'mean unchanged by dependence')
    page.locator('#reduction-range').evaluate("e=>{e.value=.4;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    check(abs(page.evaluate('ATLAS_LAST_RESULT.result.mean')-baseline*.6)<1e-9,'relative prevalence reduction')
    check(page.locator('#lab-people circle').count()==1000,'1000 people render')
    page.select_option('#panel-select','SG5');check(abs(page.evaluate('ATLAS_LAST_RESULT.result.mean')-1.01)<1e-9,'original Singapore panel retained')
    page.select_option('#panel-select','CHINA12');check(page.locator('[data-condition]').count()==12,'original China panel retained')
    check(abs(page.evaluate('ATLAS_LAST_RESULT.result.mean')-1.661)<1e-9,'China mean')
    for e in page.locator('[data-condition]').all():e.uncheck()
    check(page.evaluate('ATLAS_LAST_RESULT.result.mean')==0 and page.evaluate('ATLAS_LAST_RESULT.result.zero')==1,'all deselected defined boundary')
    page.locator('[data-action=lab-reset]').click();page.select_option('#panel-select','country');page.select_option('#lab-country','ATA')
    check(page.locator('#lab-results .empty').count()==1,'unsupported country no fabricated simulation')
    page.select_option('#lab-country','SGP')
    if not args.inline:
        page.locator('[data-action=save]').click();saved=page.evaluate("JSON.parse(localStorage.getItem('atlasv3-scenario'))")
        page.select_option('#lab-country','CHN');page.locator('[data-action=restore]').click();check(page.locator('#lab-country').input_value()=='SGP','saved scenario restored')
        original=page.url;page.reload(wait_until='networkidle');check(page.locator('#lab-country').input_value()=='SGP','URL deep-link persists')
        page.locator('button[data-nav=world]').click()
        with page.expect_download() as dl:page.locator('[data-action=export]').click()
        dl.value.save_as(str(out/'test-export.csv'));check((out/'test-export.csv').read_text().startswith('\ufeff"country_code"'),'CSV download with metadata')
        response=page.request.get(args.url+'v3/data/global.json');check(response.status==200 and response.json()['meta']['observations']==51842,'published dataset reachable')
    else:skipped.append('HTTP asset loading, origin-dependent localStorage and downloads: exercised in hosted CI, not inline rendering.')
    check(not errors,'no uncaught JavaScript exceptions')
    browser.close()
report={'mode':'inline local renderer' if args.inline else args.url,'passed':len(checks),'checks':checks,'screenshots':screens,'pageErrors':errors,'skipped':skipped,'viewports':[1440,390],'languages':['zh','en','es','fr','pt','de','ja','ar']}
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ['checks','screenshots']}))
