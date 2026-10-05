/* Health Atlas Global Edition. New interface; the original research application remains intact. */
(function (root) {
  'use strict';
  const D = root.GLOBAL_HEALTH, I = root.AtlasI18n, C = root.AtlasCharts, E = root.HealthEngine, L = root.ATLAS_LAB;
  const $ = s => document.querySelector(s), esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const countryById = new Map(D.countries.map(c => [c.id,c]));
  const safeGet = key => {try{return localStorage.getItem(key);}catch{return null;}};
  const safeSet = (key,value) => {try{localStorage.setItem(key,value);return true;}catch{return false;}};
  const initialLanguage = (navigator.language || 'en').slice(0,2);
  const defaults = {page:'world',lang:I.codes.includes(initialLanguage)?initialLanguage:'en',theme:'light',metric:'diabetes',year:2024,country:'CHN',view:'map',compare:['CHN','SGP','USA','JPN'],panel:'country',rho:.25,reduction:0,target:'all',off:[]};
  let state={...defaults, lang:safeGet('atlasv3-language')||defaults.lang,theme:safeGet('atlasv3-theme')||'light'}, mapController=null,timer=null;
  let displayNames, toastTimer, searchFilter='', regionFilter='', sortMode='value', coverageFilter='';
  const primary = D.order.filter(id=>!id.endsWith('_c'));
  const countryModelYears = D.metrics.diabetes_who_c.years.filter(y=>D.metrics.obesity_c.years.includes(y));
  function readHash(){
    const hash=location.hash.slice(1), parts=hash.split('?'),p=new URLSearchParams(parts[1]||'');
    if(['overview','library','lab','coverage','methods'].includes(parts[0])||(parts[0]==='compare'&&p.has('r'))){location.replace('./research.html'+location.hash);return false;}
    state.page=['world','compare','simulator','data'].includes(parts[0])?parts[0]:'world';
    state.lang=I.codes.includes(p.get('lang'))?p.get('lang'):(I.codes.includes(state.lang)?state.lang:'en');
    if(p.has('m'))state.metric=D.metrics[p.get('m')]?p.get('m'):'diabetes';
    state.country=countryById.has(p.get('c'))?p.get('c'):(countryById.has(state.country)?state.country:'CHN');
    state.year=p.has('y')?Number(p.get('y')):D.metrics[state.metric].latestYear;
    if(!D.metrics[state.metric].years.includes(state.year))state.year=D.metrics[state.metric].latestYear;
    state.view=p.get('view')==='table'?'table':'map';
    if(p.has('pins'))state.compare=Array.from(new Set(p.get('pins').split(',').filter(c=>countryById.has(c)))).slice(0,4);
    if(p.has('panel'))state.panel=['country','SG5','CHINA12'].includes(p.get('panel'))?p.get('panel'):'country';
    state.rho=number(p.get('rho')??state.rho,0,.8,.25);
    state.reduction=number(p.get('red')??state.reduction,0,1,0);
    state.target=p.get('target')||'all';state.off=p.get('off')?p.get('off').split(','):[];
    return true;
  }
  function number(v,lo,hi,fallback){v=Number(v);return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):fallback;}
  function url(){const p=new URLSearchParams({lang:state.lang,m:state.metric,y:state.year,c:state.country});
    if(state.view==='table')p.set('view','table');p.set('pins',state.compare.join(','));
    if(state.page==='simulator'){p.set('panel',state.panel);p.set('rho',state.rho.toFixed(4));p.set('red',state.reduction.toFixed(4));p.set('target',state.target);if(state.off.length)p.set('off',state.off.join(','));}
    return '#'+state.page+'?'+p.toString();
  }
  function persist(push=false){history[push?'pushState':'replaceState'](null,'',url());}
  function t(k){return I.dictionaries[state.lang][k]||I.dictionaries.en[k]||k;}
  function locale(){return I.locales[state.lang];}
  function name(id){const c=countryById.get(id);if(!c)return id;try{return displayNames.of(c.iso2)||c.name;}catch{return c.name;}}
  function fmt(v,metric){if(v==null||!Number.isFinite(v))return '—';const unit=typeof metric==='string'?metric:metric.unit;
    if(unit==='people')return new Intl.NumberFormat(locale(),{maximumFractionDigits:0}).format(v);
    return new Intl.NumberFormat(locale(),{minimumFractionDigits:unit==='percent'?2:4,maximumFractionDigits:unit==='percent'?2:4}).format(v)+(unit==='percent'?'%':'');
  }
  function compact(v){return new Intl.NumberFormat(locale(),{notation:'compact',maximumFractionDigits:2}).format(v);}
  function integer(v){return new Intl.NumberFormat(locale(),{maximumFractionDigits:0}).format(v);}
  function percent(v){return new Intl.NumberFormat(locale(),{style:'percent',minimumFractionDigits:2,maximumFractionDigits:2}).format(v);}
  function mean(v){return new Intl.NumberFormat(locale(),{minimumFractionDigits:4,maximumFractionDigits:4}).format(v);}
  function unit(m){return m.unit==='percent'?'%':m.unit==='per100k'?t('per100k'):m.unit==='people'?t('peopleUnit'):t('yearsUnit');}
  function label(m){return t(m.label)+(m.measure==='crude'?' · '+t('crude'):'');}
  function point(id,mid=state.metric,year=state.year){return D.metrics[mid].series[id]?.find(p=>p[0]===year)||null;}
  function latest(id,mid){const s=D.metrics[mid].series[id];return s?.[s.length-1]||null;}
  function icon(type){const paths={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',moon:'<path d="M20.4 13.2A8.8 8.8 0 0 1 10.8 3.6a8.8 8.8 0 1 0 9.6 9.6Z"/>',share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',play:'<path d="m8 4 12 8-12 8Z"/>',pause:'<path d="M8 4v16M16 4v16"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'};return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[type]||paths.arrow}</svg>`;}
  function notice(text,warning=false){return `<div class="notice${warning?' warning':''}">${icon('info')}<span>${esc(text)}</span></div>`;}
  function optionsMetric(){return D.order.map(id=>`<option value="${id}" ${id===state.metric?'selected':''}>${esc(label(D.metrics[id]))}</option>`).join('');}
  function optionsYear(){return D.metrics[state.metric].years.slice().reverse().map(y=>`<option value="${y}" ${y===state.year?'selected':''}>${y}</option>`).join('');}
  function countryOptions(selected=state.country,ids){return D.countries.filter(c=>!ids||ids.has(c.id)).sort((a,b)=>name(a.id).localeCompare(name(b.id),locale())).map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${esc(name(c.id))}</option>`).join('');}
  function toolbar(extra=''){return `<div class="atlas-toolbar"><div class="toolbar-fields"><div class="field wide"><label for="metric-select">${t('indicator')}</label><select id="metric-select">${optionsMetric()}</select></div><div class="field"><label for="year-select">${t('year')}</label><select id="year-select">${optionsYear()}</select></div></div>${extra}</div>`;}
  function searchBox(kind){return `<div class="search-zone"><label class="sr-only" for="country-search-${kind}">${t('searchLabel')}</label><input id="country-search-${kind}" class="search-input" data-search="${kind}" type="search" autocomplete="off" placeholder="${esc(t('search'))}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results-${kind}"><div id="search-results-${kind}" class="search-results" role="listbox" hidden></div></div>`;}
  function header(){
    $('#header').innerHTML=`<a class="logo" href="#world" data-nav="world" aria-label="Health Atlas"><svg class="logo-mark" viewBox="0 0 36 36" aria-hidden="true"><rect x="1" y="1" width="34" height="34" rx="11" fill="currentColor"/><path d="M9 19h6l3-8 3 15 3-7h4" fill="none" stroke="var(--paper)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span><span class="wordmark">Health Atlas</span><span class="edition">${esc(t('brand'))} · 03</span></span></a><nav class="topnav" aria-label="Health Atlas">${['world','compare','simulator','data'].map(v=>`<button data-nav="${v}" class="${state.page===v?'active':''}" ${state.page===v?'aria-current="page"':''}>${t(v)}</button>`).join('')}</nav><div class="utilities"><select id="language-select" aria-label="${esc(t('language'))}">${I.codes.map(l=>`<option value="${l}" ${l===state.lang?'selected':''}>${I.names[l]}</option>`).join('')}</select><button id="theme-toggle" class="icon-btn" title="${esc(t('theme'))}" aria-label="${esc(t('theme'))}">${icon(state.theme==='dark'?'sun':'moon')}</button><button class="btn share-top" data-action="share">${icon('share')}${t('share')}</button></div>`;
    $('#skip').textContent=t('skip');
    $('#footer').innerHTML=`<div><div class="footer-brand">Health Atlas · ${esc(t('brand'))}</div><div>${esc(t('privacy'))}</div><div>${esc(t('disclaimer'))}</div></div><div class="footer-right"><div>${esc(t('retrieved'))} · ${D.meta.retrieved} · v${D.meta.version}</div><div>${esc(t('fresh'))}</div><a href="./research.html">${esc(t('archive'))}</a> · <a href="https://github.com/ChaoYue0307/ChaoYue0307.github.io/tree/master/health-atlas" target="_blank" rel="noopener">GitHub ↗</a></div>`;
  }
  function intro(title1,title2,body,stats=false){return `<section class="hero"><div><h1>${esc(title1)}${title2?`<br><span>${esc(title2)}</span>`:''}</h1><p class="intro">${esc(body)}</p></div>${stats?`<div class="hero-stats"><div class="stat"><strong>${integer(D.meta.countries)}</strong><small>${t('locations')}</small></div><div class="stat"><strong id="covered-count">${integer(Object.keys(D.metrics[state.metric].series).filter(id=>point(id)).length)}</strong><small>${t('covered')}</small></div><div class="stat"><strong>8</strong><small>${t('languages')}</small></div></div>`:''}</section>`;}
  function world(){
    const tab=`<div class="segmented" role="group" aria-label="${t('map')}/${t('table')}"><button data-view="map" class="${state.view==='map'?'active':''}" aria-pressed="${state.view==='map'}">${t('map')}</button><button data-view="table" class="${state.view==='table'?'active':''}" aria-pressed="${state.view==='table'}">${t('table')}</button></div>`;
    $('#content').innerHTML=intro(t('hero1'),t('hero2'),t('intro'),true)+`<div class="page-tools">${searchBox('world')}<button class="btn" data-action="export">${icon('download')}${t('export')}</button></div><section class="atlas-panel">${toolbar(tab)}<div class="atlas-content"><div class="map-side">${state.view==='map'?`<div class="map-meta"><span class="measure-pill" id="measure-tag"></span><span class="small" id="map-age"></span></div><div class="map-stage" id="map-stage"></div><div class="map-zoom"><button class="icon-btn" data-zoom="in" aria-label="${t('zoomIn')}">${icon('plus')}</button><button class="icon-btn" data-zoom="out" aria-label="${t('zoomOut')}">${icon('minus')}</button><button class="icon-btn" data-zoom="reset" aria-label="${t('reset')}">${icon('reset')}</button></div><div id="map-legend" class="map-legend"></div><div class="map-notes" id="map-notes"></div>`:`<div class="country-list-controls"><input id="table-search" type="search" aria-label="${t('searchLabel')}" placeholder="${esc(t('search'))}"><select id="region-select" aria-label="${t('region')}"><option value="">${t('allRegions')}</option>${['EAS','ECS','LCN','MEA','NAC','SAS','SSF','OTH'].map(r=>`<option value="${r}" ${r===regionFilter?'selected':''}>${t(r)}</option>`).join('')}</select><select id="sort-select" aria-label="${t('table')}"><option value="value">${t('sortValue')}</option><option value="name" ${sortMode==='name'?'selected':''}>${t('sortName')}</option></select></div><div class="table-scroll" id="world-table"></div>`}<div class="timeline"><button class="icon-btn play" id="play-years" aria-label="${t('play')}">${icon('play')}</button><span id="timeline-min"></span><input type="range" id="year-range" min="0" step="1" aria-label="${t('year')}"><span id="timeline-max"></span><strong class="current-year" id="timeline-current"></strong></div></div><aside class="country-card" id="country-card" aria-live="polite"></aside></div></section><div class="below-map"><div class="context-block" id="country-context"></div><div class="research-callout"><h3>${t('moreResearch')}</h3><p>${t('legacyNote')}</p><a class="link-btn" href="./research.html">${t('archive')}${icon('arrow')}</a></div></div>`;
    updateWorld();
  }
  function updateWorld(){
    const m=D.metrics[state.metric];
    $('#covered-count').textContent=integer(Object.keys(m.series).filter(id=>point(id)).length);
    const range=$('#year-range');range.max=m.years.length-1;range.value=m.years.indexOf(state.year);range.setAttribute('aria-valuetext',String(state.year));
    $('#timeline-min').textContent=m.years[0];$('#timeline-max').textContent=m.latestYear;$('#timeline-current').textContent=state.year;
    if($('#year-select'))$('#year-select').value=state.year;
    if(state.view==='map'){
      $('#measure-tag').textContent=t(m.measure);$('#map-age').textContent=t(m.age);
      const zoomControls=$('.map-zoom');if(zoomControls)zoomControls.remove();
      mapController=C.createMap($('#map-stage'),{countries:D.countries,metric:m,year:state.year,country:state.country,name,format:fmt,noData:t('noData'),title:label(m)+' · '+state.year,onSelect:selectCountry});
      if(zoomControls)$('#map-stage').appendChild(zoomControls);
      $('#map-legend').innerHTML=mapController.symbols?`<span class="small">${esc(t('population'))} · ${esc(t('peopleUnit'))} · ○ ∝ √N</span><span class="small">${t('noData')} ≠ 0</span>`:`<div class="legend-scale"><div style="height:8px;border-radius:4px;background:linear-gradient(90deg,#e4edce,#216352)"></div><div class="legend-values"><span>0</span><span>${fmt(mapController.max,m)}</span></div></div><span class="small"><i class="no-data-swatch"></i>${t('noData')}</span>`;
      $('#map-notes').textContent=(mapController.symbols?t('mapHint'):t('mapRateNote')+' '+t('mapHint'))+' '+t('boundaryNote');
    }else updateWorldTable();
    countryCard();context();
  }
  function selectCountry(id){if(!countryById.has(id))return;state.country=id;hideSearch();persist();if(state.page==='world')updateWorld();else if(state.page==='simulator')renderLab();}
  function countryCard(){
    const m=D.metrics[state.metric],p=point(state.country),c=countryById.get(state.country),series=m.series[state.country]||[];
    $('#country-card').innerHTML=`<div class="country-id"><div class="small-label">${t('selected')} · ${c.id}</div><h2>${esc(name(c.id))}</h2><div class="country-english">${esc(c.sourceName||c.name)}</div></div><div class="metric-main"><div class="main-value">${p?(m.unit==='people'?compact(p[1]):fmt(p[1],m)):'—'}</div><div class="metric-context">${esc(label(m))} · ${state.year}${m.unit==='percent'?'':`<br>${esc(unit(m))}`}</div><div class="interval">${p&&p[2]!=null?`${t('uncertainty')}<br><bdi>${fmt(p[2],m)} – ${fmt(p[3],m)}</bdi>`:p?esc(t(m.age)):esc(t('missingNote'))}</div></div><div class="small-chart"><div class="small-label">${t('trend')}</div><div id="country-trend"></div><small>${t('sparse')}</small></div><button class="btn btn-light" data-action="pin" ${state.compare.includes(state.country)?'disabled':''}>${icon('plus')}${state.compare.includes(state.country)?t('pinned'):t('pin')}</button><button class="source-link" data-source="${m.id}">${t('source')} ↗</button>`;
    C.trend($('#country-trend'),{compact:true,title:label(m)+' · '+name(c.id),series:[{label:name(c.id),points:series}],intervals:true,noData:t('noData'),format:v=>fmt(v,m),axisFormat:v=>m.unit==='people'?compact(v):integer(v)});
  }
  function context(){
    $('#country-context').innerHTML=`<h3>${esc(name(state.country))}</h3><p class="small">${t('latestContext')}</p><div class="context-row">${['population','life'].map(mid=>{const p=latest(state.country,mid);return `<div class="context-metric"><span>${t(mid)}</span><strong>${p?(mid==='population'?compact(p[1]):fmt(p[1],'years')):'—'}</strong><small class="date">${p?p[0]+' · '+unit(D.metrics[mid]):t('noData')}</small><button class="source-link" data-source="${mid}">${t('source')} ↗</button></div>`;}).join('')}</div>`;
  }
  function matching(c,q){q=q.toLocaleLowerCase();return [c.name,c.sourceName||'',c.id,c.iso2,name(c.id)].some(s=>s.toLocaleLowerCase().includes(q));}
  function updateWorldTable(){
    const m=D.metrics[state.metric];let rows=D.countries.filter(c=>(!searchFilter||matching(c,searchFilter))&&(!regionFilter||c.region===regionFilter));
    rows.sort((a,b)=>sortMode==='name'?name(a.id).localeCompare(name(b.id),locale()):(point(b.id)?.[1]??-Infinity)-(point(a.id)?.[1]??-Infinity)||name(a.id).localeCompare(name(b.id),locale()));
    $('#world-table').innerHTML=`<table class="data-table"><thead><tr><th>${t('country')}</th><th>${t('estimate')} · ${unit(m)}</th><th>${t('year')}</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr class="${c.id===state.country?'highlight':''}"><td><button class="country-link" data-country="${c.id}">${esc(name(c.id))}</button><span class="iso">${c.id}</span></td><td class="v">${point(c.id)?fmt(point(c.id)[1],m):t('noData')}</td><td>${state.year}</td><td><button class="tiny-btn" data-pin="${c.id}" aria-label="${esc(t('pin')+' '+name(c.id))}" ${state.compare.includes(c.id)?'disabled':''}>${icon('plus')}</button></td></tr>`).join('')||`<tr><td colspan="4">${t('noResults')}</td></tr>`}</tbody></table><div class="table-caption">${integer(rows.length)} / ${D.meta.countries} · ${esc(t('missingNote'))}</div>`;
  }
  function compare(){
    $('#content').innerHTML=intro(t('compareTitle'),'',t('compareIntro'))+notice(t('noSum'))+`<div class="compare-controls">${state.compare.map((id,i)=>`<span class="country-chip" style="--chip:${C.colors[i]}"><i style="background:${C.colors[i]}"></i>${esc(name(id))}<button data-remove="${id}" aria-label="${esc(t('remove')+' '+name(id))}">${icon('close')}</button></span>`).join('')}${searchBox('compare')}<button class="btn" data-action="export">${icon('download')}${t('export')}</button></div><section class="atlas-panel">${toolbar(`<button class="btn" data-source="${state.metric}">${t('source')} ↗</button>`)}</section><div class="comparison-layout" style="margin-top:22px"><section class="plot-panel"><div class="plot-head"><h3>${esc(label(D.metrics[state.metric]))}</h3><span>${state.year}</span></div><div id="compare-bars" class="chart-slot"></div><p class="plot-caption">${esc(t(D.metrics[state.metric].measure))} · ${esc(t(D.metrics[state.metric].age))} · ${esc(unit(D.metrics[state.metric]))}</p></section><section class="plot-panel"><div class="plot-head"><h3>${t('trend')}</h3><button class="tiny-btn" data-export-svg="#compare-trend svg" aria-label="${t('exportChart')}">${icon('download')}</button></div><div id="compare-trend" class="chart-slot"></div><p class="plot-caption">${t('sparse')}</p></section></div><section class="plot-panel comparison-table"><h3>${t('estimate')} · ${t('uncertainty')}</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>${t('country')}</th><th>${t('estimate')}</th><th>${t('uncertainty')}</th><th>${t('year')}</th></tr></thead><tbody>${state.compare.map(id=>{const p=point(id),m=D.metrics[state.metric];return `<tr><td>${esc(name(id))}</td><td class="v">${p?fmt(p[1],m):t('noData')}</td><td>${p&&p[2]!=null?`${fmt(p[2],m)} – ${fmt(p[3],m)}`:'—'}</td><td>${state.year}</td></tr>`;}).join('')}</tbody></table></div></section>`;
    const m=D.metrics[state.metric];
    C.comparison($('#compare-bars'),{title:label(m),rows:state.compare.map((id,i)=>({label:name(id),point:point(id),color:C.colors[i]})),format:v=>fmt(v,m),noData:t('noData')});
    C.trend($('#compare-trend'),{title:label(m),series:state.compare.map((id,i)=>({label:name(id),points:m.series[id]||[],color:C.colors[i]})),format:v=>fmt(v,m),axisFormat:v=>m.unit==='people'?compact(v):integer(v),noData:t('noData')});
  }
  function labPanel(){
    if(state.panel==='country'){
      const a=point(state.country,'diabetes_who_c',2022),b=point(state.country,'obesity_c',2022);
      return {items:a&&b?[{id:'diabetes_who',p:a[1]/100},{id:'obesity',p:b[1]/100}]:[],cohort:t('cohort18'),year:'2022',country:name(state.country)};
    }
    const p=L.panels.find(p=>p.id===state.panel);
    return {items:p.items.map(x=>({...x,id:x.id==='diabetes'?'diabetes_condition':x.id})),cohort:t(state.panel==='SG5'?'cohortSG':'cohortCN'),year:p.year,country:state.panel==='SG5'?name('SGP'):name('CHN')};
  }
  function renderLab(){
    const p=labPanel();state.off=state.off.filter(id=>p.items.some(x=>x.id===id));
    if(state.target!=='all'&&!p.items.some(x=>x.id===state.target))state.target='all';
    $('#content').innerHTML=intro(t('labTitle'),'',t('labIntro'))+notice(t('fixedEstimates'))+`<div class="lab-grid"><aside class="lab-controls"><div class="field"><label for="panel-select">${t('panel')}</label><select id="panel-select">${[['country','countryPanel'],['SG5','sgPanel'],['CHINA12','cnPanel']].map(([id,k])=>`<option value="${id}" ${state.panel===id?'selected':''}>${t(k)}</option>`).join('')}</select></div>${state.panel==='country'?`<div class="field"><label for="lab-country">${t('country')}</label><select id="lab-country">${countryOptions()}</select></div>`:''}<p class="range-note">${esc(p.cohort)} · ${p.year}</p><div class="control-separator"></div><h4>${t('chooseConditions')}</h4><div class="checklist">${p.items.map(item=>`<label class="condition"><input type="checkbox" data-condition="${item.id}" ${state.off.includes(item.id)?'':'checked'}><span class="condition-name">${t(item.id)}</span><span class="number">${percent(item.p)}</span></label>`).join('')||`<p class="range-note">${t('insufficient')}</p>`}</div><div class="control-separator"></div><div class="lab-range-header"><label for="rho-range">${t('rho')}</label><strong id="rho-display">${mean(state.rho)}</strong></div><input type="range" id="rho-range" min="0" max="0.8" step="0.01" value="${state.rho}"><p class="range-note">${t('rhoNote')}</p><div class="control-separator"></div><div class="field"><label for="reduce-target">${t('reduction')}</label><select id="reduce-target"><option value="all">${t('allSelected')}</option>${p.items.map(item=>`<option value="${item.id}" ${state.target===item.id?'selected':''}>${t(item.id)}</option>`).join('')}</select></div><div class="lab-range-header"><label for="reduction-range">${t('reduction')}</label><strong id="reduction-display">${percent(state.reduction)}</strong></div><input type="range" id="reduction-range" min="0" max="1" step="0.01" value="${state.reduction}"><p class="range-note">${t('causalNote')}</p><div class="lab-actions"><button class="btn btn-primary" data-action="save">${t('save')}</button><button class="btn" data-action="restore">${t('restore')}</button><button class="btn" data-action="lab-reset">${t('reset')}</button><button class="btn" data-action="share">${icon('share')}${t('share')}</button></div><a class="source-link" href="${state.panel==='country'?'#data':'./research.html#methods'}" ${state.panel==='country'?'data-nav="data"':''}>${t('source')} ↗</a></aside><div class="lab-results" id="lab-results" aria-live="polite"></div></div><div class="formula-band"><strong>E[K] = ∑ pᵢ</strong><span>${t('meanRule')}</span></div>`;
    updateLab();
  }
  function updateLab(){
    const p=labPanel();$('#rho-display').textContent=mean(state.rho);$('#reduction-display').textContent=percent(state.reduction);
    if(!p.items.length){$('#lab-results').innerHTML=`<div class="empty"><h2>${t('noData')}</h2><p>${t('insufficient')}</p></div>`;return;}
    const chosen=p.items.filter(x=>!state.off.includes(x.id)),ps=chosen.map(x=>x.p),modified=chosen.map(x=>x.p*((state.target==='all'||state.target===x.id)?1-state.reduction:1));
    const base=E.summarize(ps,state.rho,L.quadrature), result=E.summarize(modified,state.rho,L.quadrature);
    root.ATLAS_LAST_RESULT={base,result,panel:state.panel,country:state.country,year:p.year};
    const buckets=E.bucket(result.dist),baseBuckets=E.bucket(base.dist);
    $('#lab-results').innerHTML=`<div class="lab-summary">${[['average','mean',mean],['zero','zero',percent],['multi','multiple',percent]].map(([key,prop,f],i)=>`<div class="lab-stat ${i===0?'featured':''}"><div class="label">${t(key)}</div><strong data-stat="${prop}">${f(result[prop])}</strong><div class="baseline">${t('baseline')} ${f(base[prop])}</div></div>`).join('')}</div><div class="bound-box">${t('bounds')}<strong>${percent(result.lower)} – ${percent(result.upper)}</strong></div><section class="plot-panel"><div class="plot-head"><h3>${t('distribution')}</h3><button class="tiny-btn" data-export-svg="#lab-distribution svg" aria-label="${t('exportChart')}">${icon('download')}</button></div><div class="distribution-key"><span><i style="background:var(--land)"></i>${t('baseline')}</span><span><i style="background:var(--accent)"></i>${t('scenario')}</span></div><div id="lab-distribution"></div></section><section class="plot-panel population-panel"><div class="plot-head"><h3>${t('dots')}</h3><span>${esc(p.country)} · ${p.year}</span></div><div class="distribution-key">${['0','1','2','3–4','5–9','≥10'].map((label,i)=>`<span><i style="background:${C.dotColors[i]}"></i>${label} · ${percent(buckets[i])}</span>`).join('')}</div><div id="lab-people"></div><p class="plot-caption">${t('dotNote')}</p></section><p class="footnote">${t('labIntro')} ${t('fixedEstimates')}</p>`;
    C.distribution($('#lab-distribution'),{labels:['0','1','2','3–4','5–9','≥10'],baseline:baseBuckets,scenario:buckets,title:t('distribution'),percent:v=>percent(v)});
    C.people($('#lab-people'),{probabilities:buckets,title:t('dots')});
  }
  function dataPage(){
    $('#content').innerHTML=intro(t('coverageTitle'),'',t('coverageIntro'))+notice(t('sourceLag'),true)+`<div class="coverage-summary"><div><strong>${D.meta.countries}</strong><span>${t('locations')}</span></div><div><strong>${D.meta.withData}</strong><span>${t('available')} · ${t('locations')}</span></div><div><strong>${D.meta.seriesCount}</strong><span>${t('series')}</span></div><div><strong>${integer(D.meta.observations)}</strong><span>${t('observations')}</span></div></div><div class="page-tools"><a class="btn btn-primary" href="./v3/data/global.json" download>${icon('download')}${t('fullData')}</a><a class="btn" href="./v3/data/observations.csv" download>${t('export')}</a><button class="btn" data-action="print">${t('print')}</button></div><section><h2>${t('allSources')}</h2><div class="source-list">${D.order.map(id=>{const m=D.metrics[id];return `<article class="source-item"><h3><button class="link-btn" data-source="${id}">${esc(label(m))} ↗</button></h3><div class="tags"><span>${t(m.measure)}</span><span>${t(m.age)}</span><span>${m.years[0]}–${m.latestYear}</span></div><p class="source-note">${esc(m.source)} · ${integer(m.countriesLatest)} ${t('locations')} (${m.latestYear})</p><button class="source-link" data-source="${id}">${t('source')} ↗</button></article>`;}).join('')}</div></section><section class="plot-panel coverage-grid-wrap"><h3>${t('locations')} × ${t('series')}</h3><div class="country-list-controls"><input type="search" id="coverage-search" aria-label="${t('searchLabel')}" placeholder="${esc(t('search'))}"></div><div class="table-scroll" id="coverage-table"></div></section><div class="method-text"><section><h3>${t('integrity')}</h3><p>${t('noSum')}</p><p>${t('sparse')}</p><p>${t('dataLimit')} ${t('incomplete')}</p><a href="./v3/data/provenance.json" target="_blank" rel="noopener">${t('source')} · JSON ↗</a></section><section><h3>${t('moreResearch')}</h3><p>${t('legacyNote')}</p><p>${t('sourceSafety')}</p><a href="./research.html">${t('archive')}</a></section></div>`;
    updateCoverage();
  }
  function updateCoverage(){const mids=primary;
    $('#coverage-table').innerHTML=`<table class="data-table"><thead><tr><th>${t('country')}</th>${mids.map(id=>`<th><button data-source="${id}">${esc(label(D.metrics[id]))}<br>${D.metrics[id].latestYear}</button></th>`).join('')}</tr></thead><tbody>${D.countries.filter(c=>!coverageFilter||matching(c,coverageFilter)).map(c=>`<tr><td><button class="country-link" data-explore="${c.id}">${esc(name(c.id))}</button><span class="iso">${c.id}</span></td>${mids.map(id=>{const m=D.metrics[id],p=point(c.id,id,m.latestYear);return `<td>${p?`<button data-observe="${c.id}|${id}" aria-label="${esc(name(c.id)+' '+label(m)+' '+fmt(p[1],m))}"><span class="coverage-dot"></span><span class="small">${fmt(p[1],m)}</span></button>`:`<span class="coverage-missing" aria-label="${t('noData')}">—</span>`}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function render(){
    stopPlay();C.hideTip();
    document.documentElement.lang=locale();document.documentElement.dir=state.lang==='ar'?'rtl':'ltr';document.documentElement.dataset.theme=state.theme;
    displayNames=new Intl.DisplayNames([locale(),'en'],{type:'region'});
    document.title=`${t(state.page)} · Health Atlas`;
    header();
    ({world,compare,simulator:renderLab,data:dataPage}[state.page])();
    persist();
  }
  function navigate(page){if(!['world','compare','simulator','data'].includes(page))return;state.page=page;persist(true);render();window.scrollTo({top:0,behavior:'instant'});}
  function pin(id){if(state.compare.includes(id))return;if(state.compare.length===4){toast(t('compareLimit'));return;}state.compare.push(id);persist();toast(t('pinned'));if(state.page==='compare')compare();else if(state.page==='world'){countryCard();if(state.view==='table')updateWorldTable();}}
  function hideSearch(){document.querySelectorAll('.search-results').forEach(x=>x.hidden=true);document.querySelectorAll('[data-search]').forEach(x=>x.setAttribute('aria-expanded','false'));}
  function search(input){const kind=input.dataset.search,box=$('#search-results-'+kind),q=input.value.trim();
    const matches=D.countries.filter(c=>matching(c,q)&&!(kind==='compare'&&state.compare.includes(c.id))).sort((a,b)=>name(a.id).localeCompare(name(b.id),locale())).slice(0,8);
    box.innerHTML=matches.map(c=>`<button role="option" id="search-${kind}-${c.id}" data-search-pick="${c.id}" data-kind="${kind}" aria-selected="false">${esc(name(c.id))}<small>${c.id} · ${esc(c.name)}</small></button>`).join('')||`<div class="small" style="padding:12px">${t('noResults')}</div>`;
    box.hidden=false;input.setAttribute('aria-expanded','true');
  }
  function toast(text){const box=$('#toast');clearTimeout(toastTimer);box.textContent=text;box.classList.add('show');toastTimer=setTimeout(()=>box.classList.remove('show'),3500);}
  function showSource(mid){const m=D.metrics[mid];if(!m)return;const p=point(state.country,mid,Math.min(state.year,m.latestYear));
    $('#dialog-body').innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${esc(label(m))}</h2><button class="icon-btn" data-action="close-dialog" aria-label="${t('close')}">${icon('close')}</button></div><div class="dialog-content"><p class="small">${t('sourceSafety')}</p><dl><dt>${t('source')}</dt><dd>${esc(m.source)}</dd><dt>${t('methodType')}</dt><dd>${t(m.measure)}</dd><dt>${t('country')}</dt><dd>${t(m.age)}</dd><dt>${t('unit')}</dt><dd>${unit(m)}</dd><dt>${t('period')}</dt><dd>${m.years[0]}–${m.latestYear}</dd><dt>${t('available')}</dt><dd>${m.countriesLatest} / ${D.meta.countries} · ${m.latestYear}</dd><dt>${t('retrieved')}</dt><dd>${D.meta.retrieved}</dd></dl><div class="source-original" lang="en"><strong>${t('originalMetadata')}</strong><p>${esc(m.definition)}</p><code>${esc(m.code)}</code></div><p class="small">${t('sourceLag')}</p><div class="dialog-actions"><a class="btn btn-primary" href="${esc(m.sourceURL)}" target="_blank" rel="noopener">${t('readMore')}</a><a class="btn" href="${esc(m.apiURL)}" target="_blank" rel="noopener">API ↗</a></div></div>`;
    $('#source-dialog').showModal();
  }
  async function share(){persist();const link=location.href;try{await navigator.clipboard.writeText(link);toast(t('copied'));}catch{
    $('#dialog-body').innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${t('manualCopy')}</h2><button class="icon-btn" data-action="close-dialog" aria-label="${t('close')}">${icon('close')}</button></div><div class="dialog-content"><input readonly value="${esc(link)}" aria-label="${t('share')}"></div>`;$('#source-dialog').showModal();$('#dialog-body input').select();}}
  function exportCSV(){const m=D.metrics[state.metric],ids=state.page==='compare'?state.compare:D.countries.map(c=>c.id);
    const rows=[['country_code','country','indicator','measure','population','year','value','unit','lower','upper','source','retrieved'],...ids.map(id=>{const p=point(id);return [id,countryById.get(id).name,m.code,m.measure,m.age,state.year,p?.[1]??'',m.unit,p?.[2]??'',p?.[3]??'',m.sourceURL,D.meta.retrieved];})];
    const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const a=document.createElement('a'),u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=u;a.download=`health-atlas-${state.metric}-${state.year}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
  }
  function stopPlay(){if(timer){clearInterval(timer);timer=null;}const b=$('#play-years');if(b){b.innerHTML=icon('play');b.setAttribute('aria-label',t('play'));}}
  function play(){if(timer){stopPlay();return;}const b=$('#play-years');b.innerHTML=icon('pause');b.setAttribute('aria-label',t('pause'));timer=setInterval(()=>{const years=D.metrics[state.metric].years;state.year=years[(years.indexOf(state.year)+1)%years.length];updateWorld();persist();},1500);}
  document.addEventListener('click',event=>{
    if(event.target.closest('#skip')){event.preventDefault();$('#content').focus();return;}
    const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();navigate(nav.dataset.nav);return;}
    const src=event.target.closest('[data-source]');if(src){showSource(src.dataset.source);return;}
    const country=event.target.closest('[data-country]');if(country){selectCountry(country.dataset.country);return;}
    const choice=event.target.closest('[data-search-pick]');if(choice){const id=choice.dataset.searchPick;if(choice.dataset.kind==='compare')pin(id);else selectCountry(id);hideSearch();document.querySelectorAll('[data-search]').forEach(x=>x.value='');return;}
    const pinned=event.target.closest('[data-pin]');if(pinned){pin(pinned.dataset.pin);return;}
    const removed=event.target.closest('[data-remove]');if(removed){state.compare=state.compare.filter(id=>id!==removed.dataset.remove);persist();compare();return;}
    const view=event.target.closest('[data-view]');if(view){state.view=view.dataset.view;stopPlay();persist();world();return;}
    const zoom=event.target.closest('[data-zoom]');if(zoom&&mapController){mapController[{in:'zoomIn',out:'zoomOut',reset:'reset'}[zoom.dataset.zoom]]();return;}
    const observe=event.target.closest('[data-observe]');if(observe){const [id,mid]=observe.dataset.observe.split('|');state.country=id;state.metric=mid;state.year=D.metrics[mid].latestYear;navigate('world');return;}
    const explore=event.target.closest('[data-explore]');if(explore){state.country=explore.dataset.explore;navigate('world');return;}
    const svg=event.target.closest('[data-export-svg]');if(svg){C.exportSVG(svg.dataset.exportSvg,'health-atlas-chart.svg');return;}
    if(event.target.closest('#theme-toggle')){state.theme=state.theme==='dark'?'light':'dark';safeSet('atlasv3-theme',state.theme);render();return;}
    if(event.target.closest('#play-years')){play();return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='share')share();
    else if(action==='export')exportCSV();
    else if(action==='pin')pin(state.country);
    else if(action==='close-dialog')$('#source-dialog').close();
    else if(action==='print')window.print();
    else if(action==='save'){const saved=safeSet('atlasv3-scenario',JSON.stringify({panel:state.panel,country:state.country,rho:state.rho,reduction:state.reduction,target:state.target,off:state.off}));toast(t(saved?'saved':'storageUnavailable'));}
    else if(action==='restore'){try{const v=JSON.parse(safeGet('atlasv3-scenario'));if(!v)throw Error();state.panel=['country','SG5','CHINA12'].includes(v.panel)?v.panel:'country';if(countryById.has(v.country))state.country=v.country;state.rho=number(v.rho,0,.8,.25);state.reduction=number(v.reduction,0,1,0);state.target=String(v.target||'all');state.off=Array.isArray(v.off)?v.off.filter(v=>typeof v==='string'):[];persist();renderLab();}catch{toast(t('noSaved'));}}
    else if(action==='lab-reset'){state.rho=.25;state.reduction=0;state.target='all';state.off=[];persist();renderLab();}
    if(!event.target.closest('.search-zone'))hideSearch();
  });
  document.addEventListener('change',event=>{const e=event.target;
    if(e.id==='language-select'){state.lang=e.value;safeSet('atlasv3-language',state.lang);persist();render();}
    else if(e.id==='metric-select'){state.metric=e.value;state.year=D.metrics[e.value].latestYear;persist();render();}
    else if(e.id==='year-select'){state.year=Number(e.value);persist();state.page==='world'?updateWorld():compare();}
    else if(e.id==='region-select'){regionFilter=e.value;updateWorldTable();}
    else if(e.id==='sort-select'){sortMode=e.value;updateWorldTable();}
    else if(e.id==='panel-select'){state.panel=e.value;state.off=[];state.target='all';state.reduction=0;persist();renderLab();}
    else if(e.id==='lab-country'){state.country=e.value;persist();renderLab();}
    else if(e.id==='reduce-target'){state.target=e.value;persist();updateLab();}
    else if(e.dataset.condition){state.off=e.checked?state.off.filter(x=>x!==e.dataset.condition):Array.from(new Set([...state.off,e.dataset.condition]));persist();updateLab();}
  });
  document.addEventListener('input',event=>{const e=event.target;
    if(e.dataset.search){search(e);}
    else if(e.id==='table-search'){searchFilter=e.value;updateWorldTable();}
    else if(e.id==='coverage-search'){coverageFilter=e.value;updateCoverage();}
    else if(e.id==='year-range'){state.year=D.metrics[state.metric].years[Number(e.value)];persist();updateWorld();}
    else if(e.id==='rho-range'){state.rho=number(e.value,0,.8,.25);persist();updateLab();}
    else if(e.id==='reduction-range'){state.reduction=number(e.value,0,1,0);persist();updateLab();}
  });
  document.addEventListener('focusin',event=>{if(event.target.dataset.search)search(event.target);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){hideSearch();C.hideTip();}
    const e=event.target;if(e.dataset.search&&(event.key==='ArrowDown'||event.key==='Enter')){const first=$('#search-results-'+e.dataset.search+' button');if(first){event.preventDefault();first.focus();}}
    const box=e.closest('.search-results');if(box&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const buttons=Array.from(box.querySelectorAll('button')),idx=buttons.indexOf(e),delta=event.key==='ArrowDown'?1:-1;buttons[(idx+delta+buttons.length)%buttons.length]?.focus();}
  });
  root.addEventListener('popstate',()=>{if(readHash())render();});
  root.addEventListener('hashchange',()=>{if(readHash())render();});
  root.addEventListener('pagehide',stopPlay);
  $('#source-dialog').addEventListener('click',event=>{if(event.target===$('#source-dialog'))$('#source-dialog').close();});
  if(readHash())render();
})(window);
