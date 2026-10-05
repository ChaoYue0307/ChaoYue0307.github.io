/* v4 deterministic analysis tests; original test suites are not modified. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),M=require('../v4/math.js'),E=require('../engine.js'),D=require('../v3/data/global.json');
let count=0;const ok=(v,n)=>{assert.ok(v,n);count++;},near=(a,b,n)=>ok(Math.abs(a-b)<1e-8,n);
let seed=293;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<1200;i++){
 const p=rand(),q=rand(),lower=Math.max(0,p+q-1),upper=Math.min(p,q);
 for(const x of [lower,upper,lower+(upper-lower)*rand()]){const j=M.joint(p,q,x);near(j.both+j.onlyA+j.onlyB+j.neither,1,'partition conservation');near(j.both+j.onlyA,p,'first marginal');near(j.both+j.onlyB,q,'second marginal');near(j.mean,p+q,'linear expectation');ok([j.both,j.onlyA,j.onlyB,j.neither].every(v=>v>=-1e-12&&v<=1+1e-12),'feasible cells');}
 const bounds=M.bounds([p,q]);near(M.joint(p,q,lower).neither,bounds.lower,'lower Fréchet endpoint');near(M.joint(p,q,upper).neither,bounds.upper,'upper Fréchet endpoint');
}
assert.throws(()=>M.joint(.2,.3,.4));assert.throws(()=>M.bounds([NaN]));assert.throws(()=>M.bounds([1.1]));count+=3;
near(M.pearson([1,2,3],[3,2,1]),-1,'negative Pearson');ok(M.pearson([1,1,1],[2,3,4])===null,'constant correlation undefined');ok(M.pearson([1,2],[2,3])===null,'too few countries');assert.deepEqual(M.ranks([1,2,2,4]),[1,2.5,2.5,4]);count++;
const j=M.join(D,'obesity','diabetes_who',2022);ok(j.n===199,'2022 shared adult observation count');ok(j.missing===51,'directory gaps not zeros');near(j.spearman,.5364732754682503,'ties handled correctly');
for(const r of j.rows){ok(r.year===2022,'no nearest-year mixing');near(r.x,M.observation(D,'obesity',r.id,2022)[1],'x provenance');near(r.y,M.observation(D,'diabetes_who',r.id,2022)[1],'y provenance');}
const region=M.join(D,'obesity','diabetes_who',2022,'NAC');ok(region.rows.every(r=>r.region==='NAC'),'exact regional filtering');ok(M.join(D,'obesity','diabetes_who',2025).n===0,'no future-year invention');
ok(M.commonYears(D,'diabetes',['CHN','ATA']).length===0,'unknown coverage not ignored');ok(M.commonYears(D,'diabetes',['CHN','SGP']).includes(2024),'shared latest year');
const changes=M.changes(D,'diabetes_who',2010,2022);ok(changes.length===199,'paired endpoints');changes.forEach(r=>near(r.delta,r.to-r.from,'paired delta'));
ok(M.metadataWarnings(D.metrics.diabetes,D.metrics.anemia).differentAge,'population mismatch');ok(M.metadataWarnings(D.metrics.tb,D.metrics.diabetes).incidence,'incidence is distinct');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'v3/lab-data.js'),'utf8'),context);const Q=context.window.ATLAS_LAB.quadrature;
for(const rho of [0,.25,.8]){const items=[{p:.2,low:.1,high:.3},{p:.3,low:.2,high:.4}],env=M.endpointEnvelope(items,rho,Q,E),mid=E.summarize(items.map(x=>x.p),rho,Q);ok(env.zero[0]<=mid.zero&&env.zero[1]>=mid.zero,'endpoint enclosure');near(env.mean[0],.3,'mean lower endpoint');near(env.mean[1],.7,'mean upper endpoint');}
ok(M.endpointEnvelope([{p:.2}],0,Q,E)===null,'missing intervals preserved');ok(M.sourceAge(D.metrics.hypertension,2026).yearLag===7,'observation date not retrieval date');
const i18n={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'v3/i18n.js'),'utf8'),i18n);vm.runInNewContext(fs.readFileSync(path.join(root,'v4/i18n.js'),'utf8'),i18n);
const lang=i18n.window.AtlasV4Translations;for(const l of ['zh','en','es','fr','pt','de','ja','ar']){assert.deepEqual(Object.keys(lang[l]).sort(),Object.keys(lang.en).sort());ok(Object.values(lang[l]).every(x=>typeof x==='string'&&x.length>0),'complete new language '+l);}
const globe={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'v4/globe.js'),'utf8'),globe);for(const lon of [-170,-75,0,60,103.8,170])for(const lat of [-60,-20,0,1.3,30,70]){const xyz=globe.window.AtlasGlobe.position(lon,lat);const xy=globe.window.AtlasGlobe.coordinate({x:xyz[0],y:xyz[1],z:xyz[2]});near(xy[0],lon,'sphere longitude mapping');near(xy[1],lat,'sphere latitude mapping');}
const receipt=M.exportRecord(D,{x:'obesity',y:'diabetes_who',year:2022},j);ok(receipt.sources.length===2&&receipt.sources.every(s=>s.sourceURL.startsWith('https://')),'receipt includes sources');ok(receipt.dataVersion==='3.0.0','data not falsely relabeled refreshed');
console.log(JSON.stringify({passed:count,groups:['joint probability conservation','sharp Fréchet bounds','ties and undefined correlations','exact-year joins','regional filtering','paired changes','source-age audit','endpoint stress envelopes','eight-language key parity','globe coordinate round-trip','export provenance']}));
