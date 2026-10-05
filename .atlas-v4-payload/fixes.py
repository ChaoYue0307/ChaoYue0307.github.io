from pathlib import Path
root=Path('health-atlas')
p=root/'v4/globe.js';s=p.read_text()
s=s.replace("camera.position.copy(v).multiplyScalar(3.6);", "camera.position.copy(v).multiplyScalar(3.6*Math.max(1,1/camera.aspect));")
s=s.replace("gl.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();request();", "gl.setSize(w,h,false);const oldFit=Math.max(1,1/camera.aspect);camera.aspect=w/h;camera.position.setLength(Math.min(7,camera.position.length()*Math.max(1,1/camera.aspect)/oldFit));camera.updateProjectionMatrix();controls.update();request();")
p.write_text(s)
p=root/'tests/browser-v4.py';s=p.read_text()
s=s.replace("not page.locator('#map-stage svg').count()", "not page.locator('#map-stage .map-countries').count()")
needle="        shot(page,'globe-zh-desktop.png')"
addition="""
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250)
        check(page.evaluate('''()=>{const c=AtlasPro.debug.globe().debug.camera;return c.position.length()*Math.sin(Math.atan(Math.tan(c.fov*Math.PI/360)*Math.min(c.aspect,1)))>1.02;}'''),'mobile globe fits the limiting field of view')
        check(not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),'mobile globe has no horizontal overflow')
        shot(page,'globe-zh-mobile.png');page.set_viewport_size({'width':1440,'height':1000});page.wait_for_timeout(200)
        with page.expect_download() as download:page.locator('[data-globe=export]').click()
        check(download.value.suggested_filename.endswith('.png'),'actual Three.js PNG export')
"""
assert needle in s
s=s.replace(needle,needle+addition)
p.write_text(s)
print('Narrow regression fixes applied: icon-aware map assertion, responsive globe framing, mobile and export tests.')
p=root/'v4/pro.js';s=p.read_text()
a="const el=globeEl;globe?.dispose?.();globe=null;el.classList.remove('pro-globe');el.dataset.renderer='fallback';const zoom=el.querySelector('.map-zoom'),c=root.AtlasCharts.createMap(el,options)"
b="const el=globeEl,zoom=el.querySelector('.map-zoom');globe?.dispose?.();globe=null;el.classList.remove('pro-globe');el.dataset.renderer='fallback';const c=root.AtlasCharts.createMap(el,options)"
assert a in s
s=s.replace(a,b);p.write_text(s)
print('Fallback preserves detached zoom controls before disposing the WebGL scene.')
