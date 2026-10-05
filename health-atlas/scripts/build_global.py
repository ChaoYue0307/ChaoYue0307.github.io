"""Build auditable global data from saved public API responses. Never infer missing values.

Usage: python scripts/build_global.py --wb /path/global-sources --who /path/who-unfiltered
The input directories are raw snapshots produced by the reviewed collection workflow.
"""
from __future__ import annotations
import argparse, json, pathlib, csv, hashlib, math, collections, shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--wb',required=True,type=pathlib.Path);parser.add_argument('--who',required=True,type=pathlib.Path)
    args=parser.parse_args();target=ROOT/'v3';(target/'data').mkdir(parents=True,exist_ok=True);(target/'vendor').mkdir(exist_ok=True)
    load=lambda p:json.loads(p.read_text(encoding='utf-8'))
    iso=load(args.wb/'iso-countries.json');wb=load(args.wb/'wb-countries.json')[1]
    countries={c['alpha_3']:{'id':c['alpha_3'],'iso2':c['alpha_2'],'numeric':c['numeric'],'name':c['name'],'region':'OTH','lng':None,'lat':None} for c in iso}
    countries['XKX']={'id':'XKX','iso2':'XK','numeric':None,'name':'Kosovo','region':'ECS','lng':20.926,'lat':42.565}
    allowed=set()
    for c in wb:
        if c['region']['id']=='NA' or c['id']=='CHI':continue
        key=c['id'];allowed.add(key)
        if key not in countries:raise ValueError(f'Unmapped World Bank location: {key}')
        countries[key].update(sourceName=c['name'],region=c['region']['id'],lng=float(c['longitude']) if c['longitude'] else None,lat=float(c['latitude']) if c['latitude'] else None)
    # World Bank region metadata is missing for certain ISO territories; do not guess region membership.
    metrics={};csvrows=[];duplicates=[]
    def add(mid,code,label,measure,age,source,definition,link,series,provider,updated=None,age_filter=None):
        seen=set();clean={}
        for loc,y,v,lo,hi in series:
            if loc not in countries: raise ValueError(f'Unmapped location {loc}')
            if not isinstance(y,int) or not 2000<=y<=2025 or v is None:continue
            if not isinstance(v,(int,float)) or not math.isfinite(v) or v<0:raise ValueError(f'Bad numeric {code} {loc} {y} {v}')
            if measure in ('standardized','crude','prevalence') and v>100:raise ValueError('Probability over 100%')
            if (loc,y) in seen:raise ValueError(f'Duplicate dimensional cell: {code} {loc} {y}')
            seen.add((loc,y));clean.setdefault(loc,[]).append([y,v,lo,hi])
            if lo is not None and hi is not None and not (lo<=v<=hi):raise ValueError('Unordered uncertainty interval')
            csvrows.append([loc,mid,code,y,v,lo,hi,age,measure,source,link])
        for rows in clean.values():rows.sort(key=lambda x:x[0])
        years=sorted({r[0] for rows in clean.values() for r in rows});last=max(years)
        metrics[mid]={'id':mid,'code':code,'label':label,'measure':measure,'age':age,'provider':provider,'source':source,'definition':definition,'sourceURL':link,'apiURL':('https://ghoapi.azureedge.net/api/'+code if provider=='WHO' else 'https://api.worldbank.org/v2/country/all/indicator/'+code+'?format=json&per_page=20000&date=2000:2025'),'unit':('years' if mid=='life' else 'people' if mid=='population' else 'per100k' if mid=='tb' else 'percent'),'years':years,'latestYear':last,'countriesAny':len(clean),'countriesLatest':sum(any(r[0]==last for r in rows) for rows in clean.values()),'rowCount':len(seen),'sourceUpdated':updated,'series':clean}
    specifications=[('diabetes','SH.STA.DIAB.ZS','diabetes','standardized','adults20_79'),('hiv','SH.DYN.AIDS.ZS','hiv','prevalence','adults15_49'),('tb','SH.TBS.INCD','tb','incidence','allAges'),('anemia','SH.ANM.ALLW.ZS','anemia','prevalence','women15_49'),('life','SP.DYN.LE00.IN','life','context','atBirth'),('population','SP.POP.TOTL','population','context','allAges')]
    for mid,code,label,measure,age in specifications:
        raw=load(args.wb/(code+'.json'));meta=load(args.wb/(code+'-meta.json'))[1][0]
        assert raw[0]['pages']==1 and len(raw[1])==raw[0]['total'], 'Incomplete World Bank pagination'
        series=[(r['countryiso3code'],int(r['date']),r['value'],None,None) for r in raw[1] if r['countryiso3code'] in allowed]
        add(mid,code,label,measure,age,meta['sourceOrganization'],meta['sourceNote'],'https://databank.worldbank.org/metadataglossary/world-development-indicators/series/'+code,series,'WDI',raw[0].get('lastupdated'))
    specs=[('hypertension','NCD_HYP_PREVALENCE_A','hypertension','standardized','adults30_79'),('hypertension_c','NCD_HYP_PREVALENCE_C','hypertension','crude','adults30_79'),('obesity','NCD_BMI_30A','obesity','standardized','adults18'),('obesity_c','NCD_BMI_30C','obesity','crude','adults18'),('diabetes_who','NCD_DIABETES_PREVALENCE_AGESTD','diabetes_who','standardized','adults18'),('diabetes_who_c','NCD_DIABETES_PREVALENCE_CRUDE','diabetes_who','crude','adults18')]
    defs={'hypertension':'Adults aged 30–79 with systolic blood pressure ≥140 mmHg, diastolic blood pressure ≥90 mmHg, or taking medication for hypertension. Both sexes; modelled estimates. This GHO API snapshot ends in 2019, despite newer headline reports.','obesity':'Adults aged 18 years and older with BMI ≥30 kg/m². Both sexes; modelled prevalence. Crude and age-standardized estimates are different measures; they are never merged.','diabetes_who':'Adults aged 18 years and older with fasting plasma glucose ≥7 mmol/L, HbA1c ≥6.5%, or on glucose-lowering medication. Both sexes; modelled estimates. The API also contains age 30+ rows; those are explicitly excluded.'}
    urls={'hypertension':'https://data.who.int/indicators/i/7DA4E68/608DE39','obesity':'https://www.who.int/data/gho/indicator-metadata-registry/imr-details/2389','diabetes_who':'https://www.who.int/data/gho/indicator-metadata-registry/imr-details/3356'}
    for mid,code,label,measure,age in specs:
        raw=load(args.who/(code+'.json'));kept=[]
        for r in raw:
            if r['SpatialDimType']!='COUNTRY' or r['Dim1']!='SEX_BTSX':continue
            if age=='adults18' and r['Dim2']!='AGEGROUP_YEARS18-PLUS':continue
            if age=='adults30_79' and r['Dim2'] is not None:raise ValueError('Unexpected hypertension age dimension')
            if r.get('Dim3') is not None:raise ValueError('Unexpected additional dimension')
            if 2000<=r['TimeDim']<=2025:
                kept.append((r['SpatialDim'],r['TimeDim'],r['NumericValue'],r.get('Low'),r.get('High')))
        add(mid,code,label,measure,age,'WHO Global Health Observatory / NCD-RisC',defs[label],urls[label],kept,'WHO',max(r['Date'] for r in raw))
    order=['diabetes','diabetes_who','hypertension','obesity','anemia','hiv','tb','life','population','diabetes_who_c','obesity_c','hypertension_c']
    allcountries=sorted(countries.values(),key=lambda c:c['id']);country_with_data={c for m in metrics.values() for c in m['series']}
    model_locs={c for c in countries if any(r[0]==2022 for r in metrics['diabetes_who_c']['series'].get(c,[])) and any(r[0]==2022 for r in metrics['obesity_c']['series'].get(c,[]))}
    payload={'meta':{'version':'3.0.0','retrieved':'2026-10-05','countries':len(countries),'withData':len(country_with_data),'countryModelCount':len(model_locs),'countryModelYear':2022,'seriesCount':len(metrics),'observations':len(csvrows),'coverage':'ISO country/territory directory plus Kosovo; not every territory has data. Country coverage is not all-disease completeness.','scope':'Selected API series retrieved on the stated date. Source updates vary. No missing cell is zero-filled.','sourceRetention':'Historical v2 data and code are preserved, not reverified by this new API ingestion.'},'countries':allcountries,'order':order,'metrics':metrics}
    (target/'data'/'global.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
    (target/'global-data.js').write_text('/* Audited public aggregate statistics; metadata and missing values are retained. */\nwindow.GLOBAL_HEALTH='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
    with (target/'data'/'observations.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f);w.writerow(['iso3','series','indicator_code','year','value','lower','upper','population_key','measure','source','source_url']);w.writerows(csvrows)
    old=load(ROOT/'data'/'atlas.json');lab={'quadrature':old['quadrature'],'panels':[p for p in old['panels'] if p['id'] in ('SG5','CHINA12')]}
    (target/'lab-data.js').write_text('window.ATLAS_LAB='+json.dumps(lab,ensure_ascii=False,separators=(',',':'))+';\n')
    provenance={'retrieved':'2026-10-05','worldBank':load(args.wb/'manifest.json'),'who':load(args.who/'manifest.json'),'rejected':['SH.MLR.INCD returned an API error; malaria was NOT fabricated or added.','CHI combines Channel Islands and is excluded; it is not assigned to either Jersey or Guernsey.'],'filters':{'who':'COUNTRY; SEX_BTSX; AGEGROUP_YEARS18-PLUS for diabetes/obesity; hypertension has no age dimension and is 30–79 by definition; 2000–2025','worldBank':'Non-aggregate countries only; null excluded without substitution; 2000–2025'},'stats':payload['meta'],'seriesSummary':{k:{a:v for a,v in m.items() if a not in ('series','definition')} for k,m in metrics.items()}}
    (target/'data'/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2))
    for fname in ['d3.min.js','topojson.min.js','d3-LICENSE','topojson-LICENSE','world-atlas-LICENSE']:shutil.copy(args.wb/fname,target/'vendor'/fname)
    topology=load(args.wb/'world-50m.json');(target/'map-data.js').write_text('window.ATLAS_GEOGRAPHY='+json.dumps(topology,separators=(',',':'))+';\n')
    print(json.dumps(payload['meta'],indent=2));print([(k,m['countriesLatest'],m['latestYear'],m['rowCount']) for k,m in metrics.items()])
if __name__=='__main__':main()
