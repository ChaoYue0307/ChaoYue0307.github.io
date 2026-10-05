/* Real Three.js globe, with a single explicitly owned WebGL context.
 * Country values retain the 2D map's scale and exact reference year.
 * Textures encode statistics, never invented patient locations or transmission.
 */
(function (root) {
  'use strict';
  const RAD=Math.PI/180;
  function position(lon,lat,r=1){return [r*Math.cos(lat*RAD)*Math.cos(lon*RAD),r*Math.sin(lat*RAD),-r*Math.cos(lat*RAD)*Math.sin(lon*RAD)];}
  function coordinate(p){const r=Math.hypot(p.x,p.y,p.z);return [Math.atan2(-p.z,p.x)/RAD,Math.asin(Math.max(-1,Math.min(1,p.y/r)))/RAD];}
  function mount(el,options,library,strings) {
    const {THREE:T,OrbitControls}=library,d3=root.d3;
    const geography=root.topojson.feature(root.ATLAS_GEOGRAPHY,root.ATLAS_GEOGRAPHY.objects.countries).features;
    const codes=new Map(options.countries.filter(c=>c.numeric).map(c=>[String(+c.numeric),c.id]));
    const code=f=>codes.get(String(+f.id))||(f.properties.name==='Kosovo'?'XKX':null);
    const extents=geography.map(f=>({f,id:code(f),bounds:d3.geoBounds(f)}));
    let o=options,disposed=false,frame=0,spinning=false,visible=true,visiblePage=!document.hidden,focusId=null,down=null,hoverAt=0;
    let gl;
    try{gl=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power',preserveDrawingBuffer:true});}catch(error){throw new Error('WebGL unavailable');}
    gl.outputColorSpace=T.SRGBColorSpace;
    gl.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    el.classList.add('pro-globe');el.dataset.renderer='three';el.replaceChildren(gl.domElement);
    gl.domElement.setAttribute('aria-label',o.title+' · '+strings.globeHint);
    gl.domElement.setAttribute('role','img');gl.domElement.setAttribute('tabindex','0');
    gl.domElement.style.touchAction='pan-y';
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,30);
    camera.position.set(0,0,3.6);
    const controls=new OrbitControls(camera,gl.domElement);
    controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=false;controls.minDistance=2.1;controls.maxDistance=7;
    controls.rotateSpeed=.55;controls.minPolarAngle=.04;controls.maxPolarAngle=Math.PI-.04;
    controls.touches={ONE:null,TWO:T.TOUCH.ROTATE};
    const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
    const ctx=canvas.getContext('2d'),tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=Math.min(gl.capabilities.getMaxAnisotropy(),4);
    const geometry=new T.SphereGeometry(1,96,64),material=new T.MeshBasicMaterial({map:tex}),earth=new T.Mesh(geometry,material);scene.add(earth);
    const markerGeometry=new T.SphereGeometry(.014,14,10),markerMaterial=new T.MeshBasicMaterial({color:'#ffbf79'}),marker=new T.Mesh(markerGeometry,markerMaterial);scene.add(marker);
    const ringGeometry=new T.RingGeometry(.025,.032,32),ringMaterial=new T.MeshBasicMaterial({color:'#ffbf79',side:T.DoubleSide}),ring=new T.Mesh(ringGeometry,ringMaterial);scene.add(ring);
    const symbolGroup=new T.Group();scene.add(symbolGroup);let symbolGeometry=null,symbolMaterial=null,symbols=null,symbolIds=[];
    const projection=d3.geoEquirectangular().scale(canvas.width/(2*Math.PI)).translate([canvas.width/2,canvas.height/2]);
    const path=d3.geoPath(projection,ctx);
    const tooltip=document.createElement('div');tooltip.className='pro-globe-tip';tooltip.hidden=true;el.appendChild(tooltip);
    const top=document.createElement('div');top.className='pro-globe-tools';
    top.innerHTML='<button type="button" class="pro-globe-btn" data-globe="rotate"></button><button type="button" class="pro-globe-btn" data-globe="focus"></button><button type="button" class="pro-globe-btn" data-globe="export"></button>';
    top.children[0].textContent=strings.rotate;top.children[1].textContent=strings.focus;top.children[2].textContent=strings.downloadPNG;
    top.children[0].setAttribute('aria-pressed','false');if(reduced.matches)top.children[0].disabled=true;
    el.appendChild(top);
    const hint=document.createElement('div');hint.className='pro-globe-hint';hint.textContent=strings.globeHint;el.appendChild(hint);
    const hatch=document.createElement('canvas');hatch.width=hatch.height=10;
    const hc=hatch.getContext('2d');hc.fillStyle='#607269';hc.fillRect(0,0,10,10);hc.strokeStyle='#a4b1aa';hc.lineWidth=1;hc.beginPath();hc.moveTo(0,0);hc.lineTo(10,10);hc.stroke();
    const pattern=ctx.createPattern(hatch,'repeat');
    function request(){if(!disposed&&!frame&&visible&&visiblePage)frame=requestAnimationFrame(render);}
    let previous=0;
    function render(time){frame=0;if(disposed||!visible||!visiblePage)return;if(spinning&&!reduced.matches){const dt=Math.min(.05,previous?(time-previous)/1000:0);camera.position.applyAxisAngle(new T.Vector3(0,1,0),.06*dt);controls.update();}previous=time;gl.render(scene,camera);el.dataset.ready='true';if(spinning)request();}
    controls.addEventListener('change',request);
    function focus(id){const f=extents.find(f=>f.id===id),c=o.countries.find(c=>c.id===id);let xy=f?d3.geoCentroid(f.f):null;
      if(!xy||!xy.every(Number.isFinite))xy=c&&Number.isFinite(c.lng)&&Number.isFinite(c.lat)?[c.lng,c.lat]:null;
      marker.visible=ring.visible=!!xy;if(!xy)return;
      const v=new T.Vector3(...position(xy[0],xy[1]));marker.position.copy(v).multiplyScalar(1.015);ring.position.copy(v).multiplyScalar(1.012);ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),v);
      if(focusId!==id){camera.position.copy(v).multiplyScalar(3.6*Math.max(1,1/camera.aspect));controls.target.set(0,0,0);controls.update();focusId=id;}request();
    }
    function clearSymbols(){while(symbolGroup.children.length)symbolGroup.remove(symbolGroup.children[0]);symbolGeometry?.dispose();symbolMaterial?.dispose();symbolGeometry=symbolMaterial=symbols=null;symbolIds=[];}
    function paint(){const max=Math.max(1,...Object.values(o.metric.series).flatMap(s=>s.map(v=>v[1])));const bound=o.metric.unit==='percent'?Math.min(100,Math.ceil(max/10)*10):Math.ceil(max/10)*10;
      const scale=d3.scaleSequential(d3.interpolateRgb('#e4edce','#216352')).domain([0,bound]);
      const values=new Map(Object.entries(o.metric.series).map(([id,s])=>[id,s.find(p=>p[0]===o.year)]));
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#122f2c';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle='#284940';ctx.lineWidth=.55;ctx.beginPath();path(d3.geoGraticule10());ctx.stroke();
      for(const item of extents){const val=values.get(item.id);ctx.beginPath();path(item.f);ctx.fillStyle=o.metric.unit==='people'?'#849b8b':val?scale(val[1]):pattern;ctx.fill();ctx.strokeStyle='#102c29';ctx.lineWidth=.8;ctx.stroke();}
      const selected=extents.find(f=>f.id===o.country);if(selected){ctx.beginPath();path(selected.f);ctx.strokeStyle='#f2aa5d';ctx.lineWidth=2;ctx.stroke();}
      tex.needsUpdate=true;clearSymbols();
      if(o.metric.unit==='people'){
        const countries=o.countries.filter(c=>values.get(c.id)&&Number.isFinite(c.lng)&&Number.isFinite(c.lat));
        symbolGeometry=new T.CircleGeometry(1,24);symbolMaterial=new T.MeshBasicMaterial({color:'#efbc73',transparent:true,opacity:.82,side:T.DoubleSide,depthWrite:false});
        symbols=new T.InstancedMesh(symbolGeometry,symbolMaterial,countries.length);symbols.renderOrder=2;
        const temp=new T.Object3D();countries.forEach((c,i)=>{const p=new T.Vector3(...position(c.lng,c.lat));temp.position.copy(p).multiplyScalar(1.011);temp.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),p);temp.scale.setScalar(.095*Math.sqrt(values.get(c.id)[1]/max));temp.updateMatrix();symbols.setMatrixAt(i,temp.matrix);symbolIds.push(c.id);});symbols.instanceMatrix.needsUpdate=true;symbolGroup.add(symbols);
      }
      focus(o.country);request();
    }
    const ray=new T.Raycaster(),pointer=new T.Vector2();
    function hit(e){const rect=gl.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
      const ground=ray.intersectObject(earth)[0];if(!ground)return null;
      if(symbols){const s=ray.intersectObject(symbols)[0];if(s&&s.distance<ground.distance+.02)return symbolIds[s.instanceId];}
      const xy=coordinate(ground.point),lon=xy[0],lat=xy[1];
      return extents.find(({f,bounds:b})=>lat>=b[0][1]&&lat<=b[1][1]&&(b[0][0]<=b[1][0]?(lon>=b[0][0]&&lon<=b[1][0]):(lon>=b[0][0]||lon<=b[1][0]))&&d3.geoContains(f,xy))?.id||null;
    }
    function pointerDown(e){down=[e.clientX,e.clientY];}
    function pointerUp(e){if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<5){const id=hit(e);if(id)o.onSelect(id);}down=null;}
    function move(e){if(performance.now()-hoverAt<90||e.buttons)return;hoverAt=performance.now();const id=hit(e);tooltip.hidden=!id;if(!id)return;
      const p=o.metric.series[id]?.find(p=>p[0]===o.year);tooltip.textContent=o.name(id)+' · '+(p?o.format(p[1],o.metric):o.noData)+' · '+o.year;
      gl.domElement.style.cursor='pointer';
    }
    function leave(){tooltip.hidden=true;gl.domElement.style.cursor='grab';}
    function key(e){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const axis=new T.Vector3(...(['ArrowLeft','ArrowRight'].includes(e.key)?[0,1,0]:[1,0,0]));camera.position.applyAxisAngle(axis,(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)*.13);controls.update();request();}else if(e.key==='Home'){focusId=null;focus(o.country);}}
    function zoom(f){camera.position.setLength(Math.max(2.1,Math.min(7,camera.position.length()*f)));controls.update();request();}
    function exportPNG(){gl.render(scene,camera);const image=document.createElement('canvas');image.width=gl.domElement.width;image.height=gl.domElement.height+94;const c=image.getContext('2d');c.fillStyle='#102722';c.fillRect(0,0,image.width,image.height);c.drawImage(gl.domElement,0,0);c.fillStyle='#f0f4ee';c.font='18px sans-serif';c.fillText('Health Atlas · '+o.title,20,image.height-58,image.width-40);c.font='12px sans-serif';c.fillText('Source: '+o.metric.source+' · '+o.metric.age+' · '+o.metric.measure,20,image.height-36,image.width-40);c.fillText('Snapshot '+root.GLOBAL_HEALTH.meta.retrieved+' · No data is not zero. Geographic view; use tables for exact values.',20,image.height-15,image.width-40);
      const a=document.createElement('a');a.href=image.toDataURL('image/png');a.download='health-atlas-globe-'+o.metric.id+'-'+o.year+'.png';a.click();}
    function click(e){const b=e.target.closest('[data-globe]');if(!b)return;e.stopPropagation();if(b.dataset.globe==='rotate'){spinning=!spinning;b.textContent=strings[spinning?'stopRotate':'rotate'];b.setAttribute('aria-pressed',String(spinning));request();}else if(b.dataset.globe==='focus'){focusId=null;focus(o.country);}else exportPNG();}
    function lost(e){e.preventDefault();if(!disposed){dispose();options.onFailure?.();}}
    function visibility(){visiblePage=!document.hidden;previous=0;if(visiblePage)request();}
    function motion(){if(reduced.matches){spinning=false;top.children[0].setAttribute('aria-pressed','false');top.children[0].textContent=strings.rotate;}top.children[0].disabled=reduced.matches;request();}
    gl.domElement.addEventListener('pointerdown',pointerDown);gl.domElement.addEventListener('pointerup',pointerUp);gl.domElement.addEventListener('pointermove',move);gl.domElement.addEventListener('pointerleave',leave);gl.domElement.addEventListener('keydown',key);gl.domElement.addEventListener('webglcontextlost',lost);top.addEventListener('click',click);
    document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);
    const resize=new ResizeObserver(()=>{if(disposed)return;const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);gl.setSize(w,h,false);const oldFit=Math.max(1,1/camera.aspect);camera.aspect=w/h;camera.position.setLength(Math.min(7,camera.position.length()*Math.max(1,1/camera.aspect)/oldFit));camera.updateProjectionMatrix();controls.update();request();});resize.observe(el);
    const observe=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;previous=0;if(visible)request();},{threshold:0});observe.observe(el);
    function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);controls.dispose();resize.disconnect();observe.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);
      gl.domElement.removeEventListener('webglcontextlost',lost);gl.domElement.removeEventListener('pointerdown',pointerDown);gl.domElement.removeEventListener('pointerup',pointerUp);gl.domElement.removeEventListener('pointermove',move);gl.domElement.removeEventListener('pointerleave',leave);gl.domElement.removeEventListener('keydown',key);top.removeEventListener('click',click);
      clearSymbols();geometry.dispose();material.dispose();tex.dispose();markerGeometry.dispose();markerMaterial.dispose();ringGeometry.dispose();ringMaterial.dispose();gl.dispose();gl.forceContextLoss();el.classList.remove('pro-globe');delete el.dataset.ready;
    }
    paint();return {update(next){o=next;paint();},dispose,zoomIn:()=>zoom(.83),zoomOut:()=>zoom(1.2),reset:()=>{focusId=null;focus(o.country);},debug:{camera,renderer:gl,earth,position,coordinate},exportPNG};
  }
  root.AtlasGlobe={mount,position,coordinate};
})(window);
