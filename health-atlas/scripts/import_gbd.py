"""Validate public GBD CSV, then write a quarantine queue without publishing it.
Usage: python scripts/import_gbd.py export.csv --output pending.json
Only all-age, both-sex, prevalence NUMBER records for Global/China/Singapore.
"""
import argparse,csv,json,math
from pathlib import Path
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('input',type=Path);ap.add_argument('--output',type=Path,default=Path('pending.json'));args=ap.parse_args()
    catalogue=json.loads((Path(__file__).resolve().parents[1]/'data/catalogue.json').read_text());valid={r['id'] for r in catalogue}
    out=[];seen=set();ignored=0
    with args.input.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        required={'measure_name','metric_name','location_name','sex_name','age_name','cause_id','year','val'}
        if not required.issubset(reader.fieldnames or []):raise ValueError('Missing required English GBD export columns')
        for r in reader:
            if not (r['measure_name']=='Prevalence' and r['metric_name']=='Number' and r['sex_name']=='Both' and r['age_name']=='All ages' and r['location_name'] in {'Global','China','Singapore'}):ignored+=1;continue
            cid,year,n=int(r['cause_id']),int(r['year']),float(r['val'])
            if cid not in valid or not 1990<=year<=2026 or not math.isfinite(n) or n<0:raise ValueError('Invalid cause/year/value')
            key=(r['location_name'],cid,year)
            if key in seen:ignored+=1;continue
            seen.add(key);r['status']='pending';r['review_note']='Verify version, license, case definition and hierarchy before publication';out.append(r)
    args.output.write_text(json.dumps({'rows':out,'ignored':ignored,'published':False},ensure_ascii=False,indent=2))
    print(f'Quarantined {len(out)} records; ignored {ignored}. No published files changed.')
if __name__=='__main__':main()
