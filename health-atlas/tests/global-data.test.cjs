/* New global-series checks. The original engine tests are retained separately. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');global.window=global;
require(path.join(root,'v3/i18n.js'));
const data=JSON.parse(fs.readFileSync(path.join(root,'v3/data/global.json')));
const E=require(path.join(root,'engine.js'));require(path.join(root,'v3/lab-data.js'));
let tests=0;const ok=(v,msg)=>{assert(v,msg);tests++;};
ok(data.countries.length===250,'directory count');
ok(new Set(data.countries.map(c=>c.id)).size===250,'unique country ids');
const ids=new Set(data.countries.map(c=>c.id));let total=0,withData=new Set();
for(const m of Object.values(data.metrics)){
 ok(!!m.sourceURL&&m.sourceURL.startsWith('https://'),'source URL');
 ok(m.measure==='context'||['standardized','crude','prevalence','incidence'].includes(m.measure),'measure semantics');
 let rows=0;
 for(const [id,points] of Object.entries(m.series)){
  ok(ids.has(id),'country mapped');let last=0;withData.add(id);
  for(const p of points){ok(Number.isFinite(p[1]),'not a null/NaN filled value');ok(p[0]>last,'ordered unique year');last=p[0];
   if(m.unit==='percent')ok(p[1]>=0&&p[1]<=100,'percent bounded');
   if(p[2]!=null)ok(p[2]<=p[1]&&p[1]<=p[3],'interval ordering');rows++;
  }
 }
 ok(rows===m.rowCount,'row count matches');total+=rows;
}
ok(total===51842&&total===data.meta.observations,'observation total');
ok(withData.size===219,'data footprint');
ok(!withData.has('ATA'),'missing Antarctica not zero filled');
ok(!data.metrics.population.series.JEY,'Channel Islands aggregate not assigned to Jersey');
for(const lang of AtlasI18n.codes){
 for(const [k,v] of Object.entries(AtlasI18n.dictionaries.en))ok(typeof AtlasI18n.dictionaries[lang][k]==='string'&&AtlasI18n.dictionaries[lang][k].length>0,lang+':'+k);
}
let models=0;
for(const c of data.countries){
 const a=data.metrics.diabetes_who_c.series[c.id]?.find(p=>p[0]===2022),b=data.metrics.obesity_c.series[c.id]?.find(p=>p[0]===2022);
 if(!a||!b)continue;models++;
 for(const rho of [0,.25,.5,.8]){
 const ps=[a[1]/100,b[1]/100],r=E.summarize(ps,rho,ATLAS_LAB.quadrature);
 ok(Math.abs(r.mean-ps.reduce((a,b)=>a+b,0))<1e-9,'mean preserved');
 ok(Math.abs(r.dist.reduce((a,b)=>a+b,0)-1)<1e-6,'normalized');
 ok(r.zero>=r.lower-1e-6&&r.zero<=r.upper+1e-6,'Frechet range');
 ok(E.allocate(E.bucket(r.dist),1000).reduce((a,b)=>a+b,0)===1000,'dot conservation');
 }
}
ok(models===199,'same-year eligible models');
ok(data.metrics.hypertension.latestYear===2019,'stale hypertension correctly marked');
ok(data.metrics.tb.measure==='incidence','TB incidence excluded from prevalence modeling');
console.log(JSON.stringify({passed:tests,countries:data.countries.length,countriesWithData:withData.size,observations:total,series:Object.keys(data.metrics).length,eligibleModels:models,languages:AtlasI18n.codes.length}));
