/* Local, evidence-led SVG renderers. Missing years are never interpolated. */
(function (root) {
  'use strict';
  const d3 = root.d3;
  const COLORS = ['#32745f', '#cf8050', '#6f86bb', '#ad6b91'];
  const DOTS = ['#cedb87', '#619b80', '#307064', '#315260', '#75618b', '#ac6b69'];
  const theme = () => {
    const s = getComputedStyle(document.documentElement);
    return Object.fromEntries(['ink', 'muted', 'line', 'orange', 'accent', 'ocean', 'land'].map(k => [k, s.getPropertyValue('--' + k).trim()]));
  };
  function frame(el, w, h, title) {
    d3.select(el).selectAll('*').remove();
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('role', 'img').attr('aria-label', title || '').attr('direction','ltr');
    svg.append('title').text(title || '');
    return svg;
  }
  function tooltip(event, text) {
    const box = document.getElementById('tooltip');
    if (!box) return;
    box.textContent = text; box.hidden = false;
    const w = Math.min(280, innerWidth - 24);
    box.style.maxWidth = w + 'px';
    box.style.left = Math.max(8, Math.min(event.clientX + 14, innerWidth - w - 10)) + 'px';
    box.style.top = Math.max(8, Math.min(event.clientY + 14, innerHeight - 100)) + 'px';
  }
  function hideTip() { const b = document.getElementById('tooltip'); if (b) b.hidden = true; }
  function createMap(el, o) {
    const width = 1000, height = 510, c = theme();
    const topology = root.ATLAS_GEOGRAPHY;
    const features = root.topojson.feature(topology, topology.objects.countries).features;
    const byNumeric = new Map(o.countries.filter(x => x.numeric).map(x => [String(+x.numeric), x.id]));
    const byISO = new Map(o.countries.map(x => [x.id, x]));
    const resolve = f => f.id != null ? byNumeric.get(String(+f.id)) : (f.properties.name === 'Kosovo' ? 'XKX' : null);
    const projection = d3.geoEqualEarth().fitExtent([[12, 12], [width - 12, height - 12]], {type: 'Sphere'});
    const path = d3.geoPath(projection);
    const svg = frame(el, width, height, o.title);
    svg.attr('class', 'world-svg');
    const defs = svg.append('defs');
    defs.append('pattern').attr('id', 'missing-hatch').attr('patternUnits', 'userSpaceOnUse').attr('width', 5).attr('height', 5)
      .append('path').attr('d', 'M-1,1L1,-1M0,5L5,0M4,6L6,4').attr('stroke', c.land).attr('stroke-width', 1);
    defs.append('clipPath').attr('id', 'map-boundary').append('path').attr('d', path({type: 'Sphere'}));
    const zoomLayer = svg.append('g');
    zoomLayer.append('path').attr('d', path({type:'Sphere'})).attr('fill', c.ocean).attr('stroke', c.line).attr('stroke-width', .65);
    zoomLayer.append('path').datum(d3.geoGraticule10()).attr('d', path).attr('class', 'map-graticule').attr('stroke', c.line).attr('stroke-width', .5).attr('fill', 'none');
    const maximum = Math.max(1, d3.max(Object.values(o.metric.series), series => d3.max(series, x => x[1])) || 1);
    const max = o.metric.unit === 'percent' ? Math.min(100, Math.ceil(maximum / 10) * 10) : Math.ceil(maximum / 10) * 10;
    const scale = d3.scaleSequential(d3.interpolateRgb('#e4edce', '#216352')).domain([0, max]);
    const values = new Map(Object.entries(o.metric.series).map(([id, s]) => [id, s.find(x => x[0] === o.year)]));
    const symbols = o.metric.unit === 'people';
    const hit = (event, f) => { const id = resolve(f); if (id) { hideTip(); o.onSelect(id); } };
    const label = f => { const id = resolve(f), p = values.get(id); return `${id ? o.name(id) : f.properties.name} · ${p ? o.format(p[1], o.metric) : o.noData} · ${o.year}`; };
    const lands = zoomLayer.append('g').attr('class', 'map-countries');
    lands.selectAll('path').data(features).join('path').attr('d', path)
      .attr('data-country', f => resolve(f) || '')
      .attr('fill', f => { const v=values.get(resolve(f)); return symbols ? c.land : v ? scale(v[1]) : 'url(#missing-hatch)'; })
      .attr('stroke', c.ocean).attr('stroke-width', .55).attr('vector-effect', 'non-scaling-stroke')
      .classed('selected', f => resolve(f) === o.country)
      .attr('tabindex', f => resolve(f) === o.country ? 0 : -1)
      .attr('role', 'button').attr('aria-label', label)
      .on('click', hit).on('keydown', (event, f) => { if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); hit(event, f);} })
      .on('mousemove', (event, f) => tooltip(event, label(f))).on('mouseleave', hideTip)
      .append('title').text(label);
    const symbolGroup = zoomLayer.append('g');
    if (symbols) {
      const radius = d3.scaleSqrt().domain([0, maximum]).range([0, 31]);
      symbolGroup.selectAll('circle').data(o.countries.filter(x => values.get(x.id) && Number.isFinite(x.lng) && Number.isFinite(x.lat))).join('circle')
        .attr('cx', d => projection([d.lng, d.lat])[0]).attr('cy', d => projection([d.lng, d.lat])[1])
        .attr('r', d => radius(values.get(d.id)[1])).attr('fill', '#44876e').attr('fill-opacity', .65).attr('stroke', '#fff').attr('stroke-width', .5)
        .on('click', (event, d) => o.onSelect(d.id)).on('mousemove', (event,d) => tooltip(event, `${o.name(d.id)} · ${o.format(values.get(d.id)[1],o.metric)}`)).on('mouseleave', hideTip);
    }
    const selected = byISO.get(o.country);
    const selectedFeature = features.find(f => resolve(f) === o.country);
    let center = selectedFeature ? d3.geoCentroid(selectedFeature) : selected && Number.isFinite(selected.lng) && Number.isFinite(selected.lat) ? [selected.lng, selected.lat] : null;
    if (center) {
      const xy = projection(center);
      const marker = zoomLayer.append('g').attr('class','pin-point').attr('transform',`translate(${xy})`).attr('aria-hidden','true').attr('pointer-events','none');
      marker.append('circle').attr('r',7).attr('fill',c.orange).attr('stroke','#fff').attr('stroke-width',2);
    }
    // Page scroll is never captured by a mouse wheel or single-finger touch gesture.
    const zoom = d3.zoom().scaleExtent([1, 5]).translateExtent([[0,0],[width,height]])
      .filter(event => !event.type.startsWith('touch') && event.type !== 'wheel' && !event.button)
      .on('zoom', event => zoomLayer.attr('transform',event.transform));
    svg.call(zoom).on('dblclick.zoom',null);
    return {max, scale, symbols, zoomIn:()=>svg.transition().duration(160).call(zoom.scaleBy,1.4), zoomOut:()=>svg.transition().duration(160).call(zoom.scaleBy,1/1.4),reset:()=>svg.transition().duration(160).call(zoom.transform,d3.zoomIdentity)};
  }
  function trend(el, o) {
    const w = o.compact ? 310 : 700, h = o.compact ? 145 : 280;
    const margin = o.compact ? {top:12,right:13,bottom:26,left:40} : {top:20,right:28,bottom:36,left:54};
    const dark = !!o.compact, c = theme();
    const ink = dark ? '#dfe9d8' : c.muted, grid = dark ? '#41655b' : c.line;
    const series = o.series.filter(s=>s.points.length);
    const all = series.flatMap(s=>s.points);
    const svg = frame(el,w,h,o.title);
    if (!all.length) {svg.append('text').attr('x',w/2).attr('y',h/2).attr('text-anchor','middle').attr('fill',ink).text(o.noData);return svg.node();}
    const extent = d3.extent(all,d=>d[0]);
    if(extent[0]===extent[1]) {extent[0]-=1;extent[1]+=1;}
    let lo=d3.min(all,d=>d[2]??d[1]), hi=d3.max(all,d=>d[3]??d[1]);
    const pad = Math.max((hi-lo)*.12, hi===0?1:Math.abs(hi)*.03);
    const x=d3.scaleLinear().domain(extent).range([margin.left,w-margin.right]);
    const y=d3.scaleLinear().domain([Math.max(0,lo-pad),hi+pad]).nice().range([h-margin.bottom,margin.top]);
    svg.append('g').attr('transform',`translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(3).tickSize(-(w-margin.left-margin.right)).tickFormat(o.axisFormat||d3.format('~s')))
      .call(g=>g.select('.domain').remove()).call(g=>g.selectAll('.tick line').attr('stroke',grid).attr('stroke-dasharray','3 4')).call(g=>g.selectAll('text').attr('fill',ink).attr('font-size',10));
    const ticks = Array.from(new Set([Math.ceil(extent[0]), Math.round((extent[0]+extent[1])/2),Math.floor(extent[1])]));
    svg.append('g').attr('transform',`translate(0,${h-margin.bottom})`).call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format('d')).tickSize(0).tickPadding(10))
      .call(g=>g.select('.domain').remove()).call(g=>g.selectAll('text').attr('fill',ink).attr('font-size',11));
    series.forEach((s,i)=>{
      const color = dark ? '#d5e99d' : s.color||COLORS[i%4];
      // Split every non-consecutive year; isolated historical points remain isolated.
      const segments=[];
      s.points.forEach(p=>{let seg=segments[segments.length-1];if(!seg||p[0]!==seg[seg.length-1][0]+1){seg=[];segments.push(seg);}seg.push(p);});
      for(const seg of segments){
        if(seg.length>1){
          if(o.intervals && seg.every(p=>p[2]!=null&&p[3]!=null)) svg.append('path').datum(seg).attr('d',d3.area().x(d=>x(d[0])).y0(d=>y(d[2])).y1(d=>y(d[3])))
            .attr('fill',color).attr('fill-opacity',.12);
          svg.append('path').datum(seg).attr('d',d3.line().x(d=>x(d[0])).y(d=>y(d[1]))).attr('fill','none').attr('stroke',color).attr('stroke-width',2.3);
        }
      }
      svg.append('g').selectAll('circle').data(s.points).join('circle').attr('cx',d=>x(d[0])).attr('cy',d=>y(d[1]))
        .attr('r',s.points.length<5?4.5:2.5).attr('fill',color)
        .on('mousemove',(event,d)=>tooltip(event,`${s.label} · ${d[0]} · ${o.format(d[1])}`)).on('mouseleave',hideTip)
        .append('title').text(d=>`${s.label} · ${d[0]} · ${o.format(d[1])}`);
    });
    return svg.node();
  }
  function comparison(el,o){
    const w=700,h=Math.max(150,o.rows.length*76+55),c=theme();
    const svg=frame(el,w,h,o.title),left=186,right=110;
    const max=Math.max(1,d3.max(o.rows,d=>d.point?(d.point[3]??d.point[1]):0));
    const x=d3.scaleLinear().domain([0,max*1.04]).range([left,w-right]);
    o.rows.forEach((r,i)=>{
      const y=36+i*76;
      svg.append('text').attr('x',left-18).attr('y',y+5).attr('text-anchor','end').attr('fill',c.ink).attr('font-size',13).text(r.label.length>23?r.label.slice(0,22)+'…':r.label).append('title').text(r.label);
      if(!r.point){svg.append('text').attr('x',left+8).attr('y',y+5).attr('fill',c.muted).attr('font-size',13).text(o.noData);return;}
      svg.append('rect').attr('x',left).attr('y',y-12).attr('width',Math.max(1,x(r.point[1])-left)).attr('height',24).attr('rx',4).attr('fill',r.color||COLORS[i]);
      if(r.point[2]!=null&&r.point[3]!=null){
        svg.append('path').attr('d',`M${x(r.point[2])},${y-7}v14M${x(r.point[2])},${y}H${x(r.point[3])}M${x(r.point[3])},${y-7}v14`).attr('stroke',c.ink).attr('stroke-width',1.3).attr('fill','none');
      }
      svg.append('text').attr('x',w-right+14).attr('y',y+5).attr('fill',c.ink).attr('font-size',15).attr('font-weight',600).text(o.format(r.point[1]));
    });
    return svg.node();
  }
  function distribution(el,o){
    const c=theme(),w=720,h=225,left=48,right=16,top=24,bottom=37;
    const rows=o.labels.map((l,i)=>({label:l,a:o.baseline[i],b:o.scenario[i]}));
    const svg=frame(el,w,h,o.title),x=d3.scaleBand().domain(o.labels).range([left,w-right]).padding(.3);
    const y=d3.scaleLinear().domain([0,Math.min(1,Math.max(.1,d3.max(rows,r=>Math.max(r.a,r.b))*1.2))]).nice().range([h-bottom,top]);
    svg.append('g').attr('transform',`translate(${left},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(w-left-right)).tickFormat(d=>o.percent(d)))
      .call(g=>g.select('.domain').remove()).call(g=>g.selectAll('.tick line').attr('stroke',c.line).attr('stroke-dasharray','3 4')).call(g=>g.selectAll('text').attr('fill',c.muted).attr('font-size',10));
    rows.forEach(r=>{
      const cx=x(r.label),bw=x.bandwidth()/2;
      svg.append('rect').attr('x',cx).attr('y',y(r.a)).attr('width',bw).attr('height',Math.max(0,h-bottom-y(r.a))).attr('rx',3).attr('fill',c.land);
      svg.append('rect').attr('x',cx+bw+3).attr('y',y(r.b)).attr('width',bw).attr('height',Math.max(0,h-bottom-y(r.b))).attr('rx',3).attr('fill',c.accent);
      svg.append('text').attr('x',cx+x.bandwidth()/2).attr('y',Math.min(y(r.a),y(r.b))-7).attr('text-anchor','middle').attr('fill',c.ink).attr('font-size',11).text(o.percent(r.b));
      svg.append('text').attr('x',cx+x.bandwidth()/2).attr('y',h-12).attr('text-anchor','middle').attr('fill',c.muted).attr('font-size',12).text(r.label);
    });
    return svg.node();
  }
  function people(el,o){
    const width=720,cols=50,step=14,rows=20;
    const svg=frame(el,width,rows*12+8,o.title).attr('class','dot-svg');
    const allocated=root.HealthEngine.allocate(o.probabilities,1000);
    let idx=0;
    allocated.forEach((count,group)=>{
      const g=svg.append('g').attr('fill',DOTS[group]);
      for(let j=0;j<count;j++,idx++) g.append('circle').attr('cx',12+(idx%cols)*step).attr('cy',8+Math.floor(idx/cols)*12).attr('r',3.6);
    });
    return svg.node();
  }
  function exportSVG(selector,filename){
    const original=document.querySelector(selector); if(!original)return false;
    const clone=original.cloneNode(true);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('width',original.viewBox.baseVal.width);clone.setAttribute('height',original.viewBox.baseVal.height);
    clone.style.background=getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    clone.querySelectorAll('text').forEach(n=>{n.setAttribute('font-family','Arial, sans-serif');});
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));
    a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
  }
  root.AtlasCharts={createMap,trend,comparison,distribution,people,exportSVG,colors:COLORS,dotColors:DOTS,hideTip};
})(window);
