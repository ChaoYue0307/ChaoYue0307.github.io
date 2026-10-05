"""Test the additive Three.js/ECharts release; keep all original tests intact.
Inline mode checks layout only when local HTTP/WebGL is administratively unavailable.
The release gate uses real HTTP and requires a working Three.js renderer.
"""
import argparse,json,pathlib,re,time
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://localhost:8000/health-atlas/');ap.add_argument('--out',default='/tmp/atlas-v4-qa');ap.add_argument('--inline',action='store_true');ap.add_argument('--chromium');args=ap.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[];screens=[]
def check(value,label):
    checks.append({'test':label,'pass':bool(value)})
    if not value:raise AssertionError(label)
def shot(page,name):
    page.screenshot(path=str(out/name),full_page=True);screens.append(name)
report={'scope':'inline only' if args.inline else 'real HTTP + WebGL + storage + downloads'}
try:
 with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.set_default_timeout(20000)
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    if args.inline:
        html=(root/'index.html').read_text()
        html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(root/m[1]).read_text()+'</style>',html)
        html=re.sub(r'<script src="([^"]+)" defer></script>',lambda m:'<script>'+(root/m[1]).read_text().replace('</script','<\\/script')+'</script>',html)
        vendors=''.join('<script>'+(root/'v4/vendor'/f).read_text().replace('</script','<\\/script')+'</script>' for f in ['three.bundle.js','echarts.bundle.js'])
        html=html.replace('<body>','<body>'+vendors)
        page.evaluate("location.hash='world?lang=zh'");page.set_content(html,wait_until='load')
    else:
        r=page.goto(args.url+'#world?lang=zh',wait_until='networkidle');check(r.status==200,'entrypoint HTTP 200')
        check(not any('v4/vendor/' in u for u in requests),'heavy libraries not loaded on default 2D page')
    check(page.locator('.map-countries path').count()==241,'original map geometry retained')
    page.locator('[data-view=globe]').click();page.wait_for_function("window.ATLAS_GLOBE_STATE?.mode === 'three' || window.ATLAS_GLOBE_STATE?.mode === 'fallback'")
    if not args.inline:
        check(page.evaluate('ATLAS_GLOBE_STATE.mode')=='three','real Three.js WebGL renderer, not fallback')
        page.wait_for_selector('#map-stage[data-ready=true]');page.wait_for_timeout(350)
        check(page.evaluate('AtlasPro.debug.globe().debug.renderer.info.render.triangles')>100,'actual GPU scene geometry rendered')
        check(page.locator('#map-stage canvas').count()==1,'one focal WebGL canvas')
        check(not page.locator('#map-stage .map-countries').count(),'no duplicate fallback while globe active')
        shot(page,'globe-zh-desktop.png')
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250)
        check(page.evaluate('''()=>{const c=AtlasPro.debug.globe().debug.camera;return c.position.length()*Math.sin(Math.atan(Math.tan(c.fov*Math.PI/360)*Math.min(c.aspect,1)))>1.02;}'''),'mobile globe fits the limiting field of view')
        check(not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),'mobile globe has no horizontal overflow')
        shot(page,'globe-zh-mobile.png');page.set_viewport_size({'width':1440,'height':1000});page.wait_for_timeout(200)
        with page.expect_download() as download:page.locator('[data-globe=export]').click()
        check(download.value.suggested_filename.endswith('.png'),'actual Three.js PNG export')

        original=page.evaluate('AtlasPro.debug.globe().debug.camera.position.length()')
        page.locator('[data-zoom=in]').click();page.wait_for_timeout(180)
        check(page.evaluate('AtlasPro.debug.globe().debug.camera.position.length()')<original,'real globe zoom')
        page.locator('[data-globe=focus]').click()
        page.evaluate("""()=>{const d=AtlasPro.debug.globe().debug;d.camera.position.set(...d.position(-53,-10,3.6));d.camera.lookAt(0,0,0);d.renderer.render(d.earth.parent,d.camera);} """)
        canvas=page.locator('#map-stage canvas');rect=canvas.bounding_box();canvas.click(position={'x':rect['width']/2,'y':rect['height']/2})
        page.wait_for_function("AtlasBridge.state().country==='BRA'")
        check(page.evaluate('AtlasBridge.state().country')=='BRA','sphere raycast maps geographic Brazil to BRA data')
        page.select_option('#metric-select','obesity');page.select_option('#year-select','2019')
        page.wait_for_function('ATLAS_GLOBE_STATE.year===2019');check('2019' in page.locator('.metric-context').inner_text(),'globe year and country card linked')
        page.wait_for_selector('#map-stage[data-ready=true]');page.emulate_media(reduced_motion='reduce')
        check(page.locator('[data-globe=rotate]').is_disabled(),'reduced motion disables ambient rotation');page.emulate_media(reduced_motion='no-preference')
        page.locator('[data-globe=rotate]').click();check(page.locator('[data-globe=rotate]').get_attribute('aria-pressed')=='true','user-initiated rotation');page.locator('[data-globe=rotate]').click()
        page.evaluate('AtlasPro.debug.globe().debug.renderer.forceContextLoss()')
        page.wait_for_function("ATLAS_GLOBE_STATE.mode==='fallback'")
        check(page.locator('.map-countries path').count()==241,'context loss returns to operational 2D map')
        check(page.locator('[data-zoom=in]').count()==1,'fallback retains zoom controls')
    for lang in ['zh','en','es','fr','pt','de','ja','ar']:
        page.select_option('#language-select',lang)
        for width in [1440,390]:
            page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
            for view in ['insights','simulator','data']:
                page.locator(f'.topnav button[data-nav={view}]').click()
                page.wait_for_selector({'insights':'#pro-scatter[data-chart-ready=true]','simulator':'#pro-sensitivity[data-chart-ready=true]','data':'#pro-audit'}[view])
                check(len(page.locator('#content').inner_text())>300,f'{lang} {width} {view}: substantive content')
                check(not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'{lang} {width} {view}: no horizontal overflow')
                check(page.evaluate('document.documentElement.dir')==('rtl' if lang=='ar' else 'ltr'),f'{lang} {width} {view}: direction')
                if (lang=='zh' and width==1440) or (lang in ['zh','ar'] and width==390 and view=='insights'):
                    shot(page,f'{view}-{lang}-{width}.png')
    page.set_viewport_size({'width':1440,'height':1000});page.select_option('#language-select','en');page.locator('.topnav [data-nav=insights]').click();page.wait_for_selector('#pro-scatter[data-chart-ready=true]')
    check(page.evaluate('ATLAS_ANALYSIS_RESULT.n')==199,'same-year country join')
    page.select_option('#pro-region','NAC');page.wait_for_selector('#pro-scatter[data-chart-ready=true]')
    check(page.evaluate("ATLAS_ANALYSIS_RESULT.rows.every(r=>r.region==='NAC')"),'regional filter applied to correlation and chart')
    page.select_option('#pro-region','');page.select_option('#pro-x','anemia');page.wait_for_selector('#pro-scatter[data-chart-ready=true]')
    check('differ in age' in page.locator('.pro-reading-notes').inner_text(),'population mismatch visible')
    page.locator('[data-pro-preset="obesity|diabetes_who"]').click();page.wait_for_selector('#pro-scatter[data-chart-ready=true]')
    page.locator('.pro-table-details').first.locator('summary').click();page.locator('[data-pro-country=SGP]').click()
    check('Singapore' in page.locator('#pro-selected').inner_text(),'accessible table country selection linked to analysis')
    page.locator('#pro-selected [data-source]').first.click();check(page.locator('#source-dialog').is_visible(),'new analysis opens original source metadata');page.keyboard.press('Escape')
    page.select_option('#pro-from','2022');page.select_option('#pro-to','2022');check(page.evaluate('ATLAS_CHANGE_RESULT.rows.length')==0,'identical endpoint not fabricated as a trend')
    page.select_option('#pro-from','2010');check(page.evaluate('ATLAS_CHANGE_RESULT.rows.length')==199,'paired-year changes restored')
    page.locator('#theme-toggle').click();page.wait_for_selector('#pro-scatter[data-chart-ready=true]');shot(page,'insights-en-dark.png');page.locator('#theme-toggle').click()
    if not args.inline:
        with page.expect_download() as download:page.locator('[data-pro=export-analysis]').click()
        data=json.loads(pathlib.Path(download.value.path()).read_text());check(data['dataVersion']=='3.0.0' and len(data['sources'])==2,'export includes reproducibility and source receipt')
        with page.expect_download() as download:page.locator('[data-pro=export-scatter]').click()
        check(download.value.suggested_filename.endswith('.png'),'actual ECharts PNG export')
    page.locator('.topnav [data-nav=simulator]').click();page.select_option('#panel-select','country');page.select_option('#lab-country','SGP');page.wait_for_selector('#pro-overlap')
    page.locator('#pro-overlap').evaluate("e=>{e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    check(abs(page.evaluate('ATLAS_OVERLAP_RESULT.both-ATLAS_OVERLAP_RESULT.lower'))<1e-9,'exact lower overlap endpoint')
    page.locator('#pro-overlap').evaluate("e=>{e.value=1000;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    check(abs(page.evaluate('ATLAS_OVERLAP_RESULT.both-ATLAS_OVERLAP_RESULT.upper'))<1e-9,'exact upper overlap endpoint')
    mean=page.evaluate('ATLAS_LAST_RESULT.result.mean');page.locator('#rho-range').evaluate("e=>{e.value=.6;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    page.wait_for_selector('#pro-sensitivity[data-chart-ready=true]');check(abs(page.evaluate('ATLAS_LAST_RESULT.result.mean')-mean)<1e-10,'mean invariant under changed dependence')
    check(page.evaluate('ATLAS_SENSITIVITY_RESULT.envelope') is not None,'source endpoint stress test uses available intervals')
    page.select_option('#panel-select','SG5');page.wait_for_selector('#pro-sensitivity[data-chart-ready=true]')
    check(page.evaluate('ATLAS_SENSITIVITY_RESULT.envelope') is None,'missing compatible intervals do not become a band')
    check(page.locator('#pro-overlap').count()==0,'two-condition overlap not applied to five conditions')
    if not args.inline:
        page.evaluate("localStorage.removeItem('atlas-v4-notebook')");page.locator('[data-pro=pin-scenario]').click();check(page.evaluate('AtlasPro.debug.readNotebook().length')==1,'scenario pinned')
        check(page.evaluate('AtlasPro.debug.readNotebook()[0].country')=='SGP','fixed Singapore cohort labeled Singapore')
        page.reload(wait_until='networkidle');page.wait_for_selector('#pro-notebook [data-pro-restore]');check(page.locator('#pro-notebook tbody tr').count()==1,'scenario persists across reload')
        with page.expect_download() as download:page.locator('[data-pro=export-notebook]').click()
        check(json.loads(pathlib.Path(download.value.path()).read_text())['scenarios'][0]['cohort']=='SG5','notebook export metadata')
        page.locator('[data-pro-remove]').click();check(page.evaluate('AtlasPro.debug.readNotebook().length')==0,'remove saved scenario')
    page.locator('.topnav [data-nav=compare]').click();page.wait_for_selector('#pro-common-year');page.locator('#pro-common-year').click();check(page.evaluate('AtlasBridge.state().year')==page.evaluate('Math.max(...AtlasMath.commonYears(GLOBAL_HEALTH,AtlasBridge.state().metric,AtlasBridge.state().compare))'),'latest shared year aligns selected countries')
    check(not errors,'no uncaught browser exceptions')
    if not args.inline:
        page.goto(args.url+'#insights?lang=ar&x=life&z=diabetes&ay=2024&c=JPN&from=2011&to=2024',wait_until='networkidle');page.wait_for_selector('#pro-scatter[data-chart-ready=true]');check(page.evaluate('ATLAS_ANALYSIS_RESULT.x')=='life','shared analysis deep link preserved');check(page.evaluate('document.documentElement.dir')=='rtl','shared Arabic state')
    report.update(passed=len(checks),errors=errors,checks=checks,screenshots=screens);print(json.dumps({k:v for k,v in report.items() if k not in ['checks','screenshots']}));browser.close()
except Exception as e:
 report.update(failure=str(e),checks=checks,errors=errors,screenshots=screens);raise
finally:
 (out/'browser-v4-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
