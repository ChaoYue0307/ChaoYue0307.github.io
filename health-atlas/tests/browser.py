"""End-to-end tests on a local HTTP origin. Requires Playwright Chromium.
Run from any directory: python tests/browser.py
"""
from pathlib import Path
from threading import Thread
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'qa';OUT.mkdir(exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{server.server_port}/'
errors=[];checks=[]
def ok(condition,label):
    assert condition,label
    checks.append(label)
with sync_playwright() as p:
    opts={'headless':True,'args':['--no-sandbox']}
    if os.environ.get('CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
    browser=p.chromium.launch(**opts)
    page=browser.new_page(viewport={'width':1440,'height':1040},device_scale_factor=1,accept_downloads=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    for route in ['overview?r=global','overview?r=china','overview?r=singapore','library','lab?panel=SG5','compare','coverage','methods']:
        page.goto(URL+'#'+route);page.wait_for_timeout(120)
        ok(len(page.locator('#main').inner_text())>200,'Rendered '+route)
        ok(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),'No desktop overflow '+route)
        page.screenshot(path=str(OUT/(route.replace('?','-').replace('=','-')+'.png')),full_page=True)
    page.goto(URL+'#lab?panel=SG5&rho=0');page.wait_for_timeout(80)
    ok(abs(page.evaluate('HealthAtlas.getResults().mean')-1.01)<1e-8,'SG5 mean')
    ok(abs(page.evaluate('HealthAtlas.getResults().zero')-.31070660175063)<1e-8,'SG5 independent zero')
    page.locator('#rho').fill('0.5');page.locator('#rho').dispatch_event('input')
    ok(page.evaluate('HealthAtlas.getResults().zero')>.47,'Correlation responds')
    page.locator('#toggle-all').click();ok(page.evaluate('HealthAtlas.getResults().zero')==1,'All indicators deselected')
    page.locator('#reset-lab').click();page.locator('#save-scenario').click()
    page.locator('#rho').fill('0.6');page.locator('#rho').dispatch_event('input');page.locator('#load-scenario').click()
    ok(page.evaluate('HealthAtlas.getState().rho')==.25,'Local storage restore')
    page.locator('#target').select_option('hypertension');page.locator('#reduction').fill('100');page.locator('#reduction').dispatch_event('input')
    ok(abs(page.evaluate('HealthAtlas.getResults().mean')-.672)<1e-8,'Targeted prevalence reduction')
    with page.expect_download() as d:page.locator('#export-scenario').click()
    f=d.value.path();export=json.loads(Path(f).read_text());ok(bool(export),'JSON download')
    page.goto(URL+'#library?r=global');page.locator('#q').fill('MASLD');page.wait_for_timeout(350)
    ok(page.locator('tbody tr').count()==1,'Text filtering')
    page.locator('tbody [data-record]').first.click();ok(page.locator('dialog').is_visible(),'Source modal opens');page.keyboard.press('Escape')
    ok(not page.locator('dialog').is_visible(),'Source modal closes')
    page.goto(URL+'#methods');page.locator('#run-engine-check').click();ok('PASS' in page.locator('#self-test').inner_text(),'Browser engine self test')
    sample='measure_name,metric_name,location_name,sex_name,age_name,cause_id,year,val,lower,upper\nPrevalence,Number,China,Both,All ages,632,2023,17672308,13878800,22353430\nIncidence,Number,China,Both,All ages,632,2023,1,,\n'
    page.locator('#gbd-import').set_input_files({'name':'gbd.csv','mimeType':'text/csv','buffer':sample.encode()})
    page.wait_for_timeout(120);ok('1 条待审核' in page.locator('#import-result').inner_text(),'CSV import quarantined')
    ok(page.evaluate('ATLAS.records.filter(r=>r.imported).every(r=>r.status==="pending")'),'Imported rows not verified')
    ok(page.evaluate('ATLAS.panels.find(p=>p.id==="SG5").items.length')==5,'Import does not mutate model')
    for width in [390,768]:
        page.set_viewport_size({'width':width,'height':844})
        for route in ['overview','library','lab?panel=SG5','compare','coverage','methods']:
            page.goto(URL+'#'+route);page.wait_for_timeout(100)
            ok(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'No {width}px overflow '+route)
            if width==390:page.screenshot(path=str(OUT/('mobile-'+route.split('?')[0]+'.png')),full_page=True)
    page.set_viewport_size({'width':390,'height':844});page.locator('#menu').click()
    ok(page.locator('#sidebar').evaluate('(e)=>e.classList.contains("open")'),'Mobile navigation')
    ok(not errors,'No uncaught browser exceptions')
    browser.close()
server.shutdown()
(OUT/'browser-report.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
print(f'PASS: {len(checks)} browser assertions.')
