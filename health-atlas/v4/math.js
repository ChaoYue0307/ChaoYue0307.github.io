/* Health Atlas v4: pure, deterministic analysis over the existing reviewed snapshot.
 * Country-level associations are ecological, never individual-level causal effects.
 * Endpoint envelopes are sensitivity ranges, not joint confidence intervals.
 */
(function (root) {
  'use strict';
  function probabilities(ps) {
    if (!Array.isArray(ps) || ps.some(p => !Number.isFinite(p) || p < 0 || p > 1)) throw new RangeError('Probabilities must be finite and in [0,1].');
    return ps;
  }
  function bounds(ps) {
    probabilities(ps);
    const mean = ps.reduce((a,b) => a+b,0);
    return {mean, lower:Math.max(0,1-mean), upper:1-Math.max(0,...ps)};
  }
  function joint(p,q,overlap) {
    probabilities([p,q]);
    const lower=Math.max(0,p+q-1), upper=Math.min(p,q);
    if (!Number.isFinite(overlap) || overlap<lower-1e-12 || overlap>upper+1e-12) throw new RangeError('Infeasible overlap.');
    const a=Math.min(upper,Math.max(lower,overlap));
    return {lower,upper,both:a,onlyA:p-a,onlyB:q-a,neither:Math.max(0,1-p-q+a),mean:p+q};
  }
  function ranks(values) {
    const sorted=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),out=Array(values.length);
    for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].v===sorted[i].v)j++;const rank=(i+j-1)/2+1;for(let k=i;k<j;k++)out[sorted[k].i]=rank;i=j;}
    return out;
  }
  function pearson(xs,ys) {
    if(xs.length!==ys.length||xs.length<3||xs.concat(ys).some(x=>!Number.isFinite(x)))return null;
    const n=xs.length,mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;
    let xy=0,xx=0,yy=0;for(let i=0;i<n;i++){const x=xs[i]-mx,y=ys[i]-my;xy+=x*y;xx+=x*x;yy+=y*y;}
    return xx>0&&yy>0?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null;
  }
  function associations(rows) {
    const x=rows.map(r=>r.x),y=rows.map(r=>r.y);
    return {n:rows.length,pearson:pearson(x,y),spearman:pearson(ranks(x),ranks(y))};
  }
  function observation(data,metric,id,year) {
    return data.metrics[metric]?.series[id]?.find(x=>x[0]===year)||null;
  }
  function join(data,x,y,year,region='') {
    if(!data.metrics[x]||!data.metrics[y]||!Number.isInteger(year))throw new Error('Invalid join specification.');
    const eligible=data.countries.filter(c=>!region||c.region===region),rows=[];
    for(const c of eligible){const a=observation(data,x,c.id,year),b=observation(data,y,c.id,year);if(a&&b)rows.push({id:c.id,name:c.name,region:c.region,x:a[1],y:b[1],xLow:a[2],xHigh:a[3],yLow:b[2],yHigh:b[3],year});}
    return {rows,eligible:eligible.length,missing:eligible.length-rows.length,x,y,year,region,...associations(rows)};
  }
  function commonYears(data,metric,ids) {
    if(!ids.length||!data.metrics[metric])return [];
    return data.metrics[metric].years.filter(y=>ids.every(id=>observation(data,metric,id,y)));
  }
  function changes(data,metric,start,end,region='') {
    if(!Number.isInteger(start)||!Number.isInteger(end)||start>=end)throw new Error('Change endpoints must be ordered integer years.');
    return data.countries.filter(c=>!region||c.region===region).flatMap(c=>{
      const a=observation(data,metric,c.id,start),b=observation(data,metric,c.id,end);
      return a&&b?[{id:c.id,name:c.name,region:c.region,start,end,from:a[1],to:b[1],delta:b[1]-a[1],relative:a[1]===0?null:(b[1]-a[1])/a[1]}]:[];
    });
  }
  function metadataWarnings(a,b) {
    return {differentAge:a.age!==b.age,differentMeasure:a.measure!==b.measure,differentProvider:a.provider!==b.provider,incidence:[a,b].some(m=>m.measure==='incidence'),sameIndicator:a.id===b.id};
  }
  function sourceAge(metric,year) {
    if(!Number.isInteger(year))throw new Error('Invalid audit year.');
    return {latestYear:metric.latestYear,yearLag:Math.max(0,year-metric.latestYear),sourceUpdated:metric.sourceUpdated||null};
  }
  function endpointEnvelope(items,rho,quadrature,engine) {
    if(!items.length||items.some(x=>!Number.isFinite(x.low)||!Number.isFinite(x.high)||x.low<0||x.high>1||x.low>x.p||x.high<x.p))return null;
    const lo=engine.summarize(items.map(x=>x.low),rho,quadrature),hi=engine.summarize(items.map(x=>x.high),rho,quadrature);
    return {mean:[lo.mean,hi.mean],zero:[hi.zero,lo.zero],method:'marginal-endpoint sensitivity; not a confidence interval'};
  }
  function exportRecord(data,spec,result){return {schema:'health-atlas-analysis/1',application:'4.0.0',dataVersion:data.meta.version,retrieved:data.meta.retrieved,spec,result,limitations:['Country-level associations are not individual or causal effects.','Exact-year joins only; missing values are excluded, not zero-filled.','No combined country health score.'],sources:[...new Set([spec.x,spec.y,spec.metric].filter(Boolean))].map(id=>({id,code:data.metrics[id].code,sourceURL:data.metrics[id].sourceURL,definition:data.metrics[id].definition,age:data.metrics[id].age,measure:data.metrics[id].measure,unit:data.metrics[id].unit}))};}
  const api={bounds,joint,ranks,pearson,associations,observation,join,commonYears,changes,metadataWarnings,sourceAge,endpointEnvelope,exportRecord};
  root.AtlasMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
