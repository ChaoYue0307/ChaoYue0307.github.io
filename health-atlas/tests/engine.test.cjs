const assert=require('node:assert/strict');
const E=require('../engine.js');const D=require('../data/atlas.json');
let checks=0;function check(v,label){assert.ok(v,label);checks++;}
for(const panel of D.panels){for(const rho of [0,.25,.5,.75]){const ps=panel.items.map(x=>x.p),r=E.summarize(ps,rho,D.quadrature);check(Math.abs(r.dist.reduce((a,b)=>a+b,0)-1)<1e-10,'normalization');check(Math.abs(r.dist.reduce((a,b,i)=>a+b*i,0)-r.mean)<2e-5,'preserved marginal mean');check(r.dist.every(x=>x>=0),'positive probabilities');check(r.zero+1e-7>=r.lower&&r.zero-1e-7<=r.upper,'Frechet bound');check(E.allocate(E.bucket(r.dist),1000).reduce((a,b)=>a+b,0)===1000,'1000 dots');}}
check(E.summarize([],0,D.quadrature).zero===1,'empty list is zero selected indicators, NOT health');
check(E.summarize([1,0],.5,D.quadrature).mean===1,'endpoint probabilities');
assert.throws(()=>E.distribution([1.2],0,D.quadrature));checks++;
const ids=new Set(D.records.map(r=>r.id));check(ids.size===D.records.length,'record uniqueness');
for(const p of D.panels)for(const r of p.items)check(ids.has(r.recordId),'model source reference');
check(D.catalogue.length===381,'complete parsed official cause availability table');
console.log(`PASS: ${checks} mathematical and data-integrity assertions.`);
