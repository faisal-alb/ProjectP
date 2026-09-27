"""Build the immutable 24-hour environment from public, cached source files.

Run with python -m ml.build_run_bundle. No download occurs during playback.
Weather is reanalysis; building loads are calibrated simulations. Commercial
county shapes are scaled to 20 kW at their pre-showcase 95th percentile.
"""
from __future__ import annotations
import hashlib
import io
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import zipfile
import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / 'data_cache' / 'run'
OUT = ROOT / 'artifacts' / 'run'
BASE = 'https://oedi-data-lake.s3.amazonaws.com/nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock'
LOAD_URL = 'https://www.ercot.com/files/docs/2024/02/06/Native_Load_2024.zip'
COMMERCIAL_URL = BASE + '/2024/comstock_amy2018_release_2/timeseries_aggregates/by_county/upgrade=0/county=G4804530/up00-g4804530-mediumoffice.csv'

def fetch(url, name):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        r = requests.get(url, timeout=120); r.raise_for_status()
        tmp = path.with_suffix('.tmp'); tmp.write_bytes(r.content); tmp.replace(path)
    return path

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def loads():
    p = fetch(LOAD_URL, 'ercot-2024.zip')
    with zipfile.ZipFile(p) as z:
        name = next(n for n in z.namelist() if n.endswith('.xlsx'))
        df = pd.read_excel(io.BytesIO(z.read(name)))
    col = next(c for c in df if 'hour' in str(c).lower())
    raw = df[col].astype(str).str.replace('24:00', '00:00', regex=False)
    ts = pd.to_datetime(raw, errors='coerce')
    ts += pd.to_timedelta(df[col].astype(str).str.contains('24:00').astype(int), unit='D')
    # Hour-ending measurements become interval-start values; availability remains one hour later.
    df['ts'] = ts - pd.Timedelta(hours=1)
    value = next(c for c in df if str(c).upper() == 'SCENT')
    return df[['ts',value]].rename(columns={value:'load'}).dropna().drop_duplicates('ts').sort_values('ts'), p

def train_load(df):
    data = df.set_index('ts').resample('h').mean().ffill()
    features = pd.DataFrame(index=data.index)
    for lag in [1,2,24,48,168]: features[f'lag{lag}'] = data['load'].shift(lag)
    features['hour'] = features.index.hour; features['weekday'] = features.index.dayofweek
    all_rows = features.join(data['load']).dropna()
    train = all_rows[all_rows.index < '2024-06-01']
    valid = all_rows[(all_rows.index >= '2024-06-01') & (all_rows.index < '2024-08-01')]
    names = list(features)
    model = HistGradientBoostingRegressor(max_iter=120, max_leaf_nodes=15, random_state=7).fit(train[names], train['load'])
    scores = {'modelMaeMw': mean_absolute_error(valid['load'], model.predict(valid[names])),
              'persistenceMaeMw': mean_absolute_error(valid['load'], valid['lag1']),
              'seasonalMaeMw': mean_absolute_error(valid['load'], valid['lag24']),
              'trainingEnd':'2024-05-31', 'validationEnd':'2024-07-31'}
    # Export predictions by issue time and horizon, using recursive estimates, never future actuals.
    forecasts = {}
    for issue in pd.date_range('2024-08-20', '2024-08-21', freq='15min', inclusive='left'):
        known = data.loc[data.index < issue.floor('h'), 'load'].to_dict()
        predictions = []
        for target in pd.date_range(issue.floor('h'), periods=7, freq='h'):
            row = {f'lag{lag}': known.get(target-pd.Timedelta(hours=lag), list(known.values())[-1]) for lag in [1,2,24,48,168]}
            row.update(hour=target.hour, weekday=target.dayofweek)
            value = max(0, float(model.predict(pd.DataFrame([row])[names])[0]))
            known[target] = value; predictions.append(value)
        forecasts[issue.isoformat()] = predictions
    return forecasts, scores

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    grid = pd.read_parquet(ROOT/'artifacts/replay/grid.parquet').set_index('ts')
    replay_homes = pd.read_parquet(ROOT/'artifacts/replay/homes.parquet')
    ids = sorted(replay_homes.bldg_id.unique())
    def home(bid):
        # Export ids can be release-qualified strings.
        numeric = str(bid).split(':')[-1].split('_')[-1]
        p = fetch(BASE + f'/2024/resstock_amy2018_release_2/timeseries_individual_buildings/by_state/upgrade=0/state=TX/{numeric}-0.parquet', f'home-{numeric}.parquet')
        df = pd.read_parquet(p)
        col = next(c for c in df if c.startswith('out.electricity.net.energy_consumption'))
        return pd.Series(df[col].to_numpy()*4, index=pd.to_datetime(df.timestamp)-pd.Timedelta(minutes=15)), p
    with ThreadPoolExecutor(max_workers=6) as pool: homes = list(pool.map(home, ids))
    cp = fetch(COMMERCIAL_URL, 'commercial.csv')
    commercial = pd.read_csv(cp)
    time_col = next(c for c in commercial if 'timestamp' in c.lower())
    power_col = next(c for c in commercial if 'electricity.total' in c and ('kwh' in c.lower() or 'energy_consumption' in c))
    commercial = pd.Series(commercial[power_col].to_numpy()*4, index=pd.to_datetime(commercial[time_col])-pd.Timedelta(minutes=15))
    scale = 20 / commercial.loc[commercial.index < '2018-08-13'].quantile(.95)
    load, lp = loads(); forecasts, scores = train_load(load)
    load = load.set_index('ts')['load']
    weather_url = 'https://archive-api.open-meteo.com/v1/archive?latitude=30.2672&longitude=-97.7431&start_date=2024-08-19&end_date=2024-08-22&hourly=temperature_2m,relative_humidity_2m,shortwave_radiation&temperature_unit=fahrenheit&timezone=America%2FChicago'
    wp = fetch(weather_url, 'weather.json'); w = json.loads(wp.read_text())['hourly']
    weather = pd.DataFrame(w).set_index(pd.to_datetime(w['time']))
    points=[]
    for t in pd.date_range('2024-08-20', '2024-08-21',freq='15min',inclusive='left'):
        ht = t.tz_localize('America/Chicago').tz_convert('Etc/GMT+6').tz_localize(None).replace(year=2018)
        wh = weather.loc[t.floor('h')]
        points.append({'at':t.tz_localize('America/Chicago').tz_convert('UTC').isoformat(),
          'priceMwh':float(grid.loc[t,'lz_austin_price']), 'tempF':float(wh.temperature_2m),
          'humidity':float(wh.relative_humidity_2m), 'radiationWm2':float(wh.shortwave_radiation),
          'regionalLoadMw':float(load.loc[t.floor('h')]),
          'homesKw':[round(float(h.loc[ht]),5) for h,_ in homes],
          'commercialKw':[round(float(commercial.loc[ht])*scale,5)]*4})
    sources=[
      {'source':'ERCOT settlement prices', 'kind':'historical','units':'USD/MWh','geography':'LZ_AEN','version':digest(ROOT/'artifacts/replay/grid.parquet')},
      {'source':LOAD_URL,'kind':'historical','units':'MW','geography':'ERCOT South Central weather zone','version':digest(lp)},
      {'source':'Open-Meteo ERA5 / IFS reanalysis','kind':'historical','units':'F, %, W/m²','geography':'Austin','version':digest(wp),'detail':'Reanalysis, not an as-issued weather forecast.'},
      {'source':'NREL ResStock 2024 amy2018 release 2','kind':'modeled','units':'kW','geography':'Travis County','version':hashlib.sha256(''.join(digest(p) for _,p in homes).encode()).hexdigest(),'detail':'2018 standard-time building simulations aligned by local clock; not customer meters.'},
      {'source':COMMERCIAL_URL,'kind':'modeled','units':'kW','geography':'Travis County','version':digest(cp),'detail':f'County office shape scaled by {scale:.9g} to 20 kW at pre-event p95; replicated across four modeled zones.'},
      {'source':'GridFlex device and feeder parameters v1','kind':'modeled','units':'kW, kWh','geography':'Four illustrative Austin areas','version':'1','detail':'55 kW feeder capacity per area; no measured utility topology.'}]
    # Rebuild household inference inputs from readings available before each issue.
    # Static features come from the trained export; target-period weather is never read.
    from ml.baseline_model import BaselineQuantileModel
    baseline = BaselineQuantileModel.load(ROOT/'artifacts/baseline')
    names = baseline.feature_names
    templates = replay_homes.groupby('bldg_id').first()
    baseline_forecasts = {}
    errors = []
    for t in pd.date_range('2024-08-20','2024-08-21',freq='15min',inclusive='left'):
        ht = t.tz_localize('America/Chicago').tz_convert('Etc/GMT+6').tz_localize(None).replace(year=2018)
        # Weather persistence uses the most recently completed hour.
        wh = weather.loc[t.floor('h')-pd.Timedelta(hours=1)]
        rows = []
        actuals = []
        for bid,(series,_) in zip(ids,homes):
            history = series.loc[series.index < ht] / 4
            template = templates.loc[bid]
            for k in range(4):
                target = ht + pd.Timedelta(minutes=k*15)
                recent = history.iloc[-96:]
                same = history[(history.index >= ht-pd.Timedelta(days=7)) & (history.index.hour==target.hour)]
                row = {name:float(template[name]) for name in names}
                row.update(hour=target.hour,day_of_week=target.dayofweek,month=target.month,is_weekend=int(target.dayofweek>=5),
                    temp_f=float(wh.temperature_2m),humidity=float(wh.relative_humidity_2m),cloud_cover=50,
                    lag_lead=float(history.loc[target-pd.Timedelta(hours=3)]),
                    lag_lead_1h=float(history.loc[target-pd.Timedelta(hours=4)]),
                    lag_1d=float(history.loc[target-pd.Timedelta(days=1)]),lag_7d=float(history.loc[target-pd.Timedelta(days=7)]),
                    roll_24h_mean=float(recent.mean()),roll_24h_max=float(recent.max()),same_hour_7d=float(same.mean()))
                rows.append(row); actuals.append(float(series.loc[target]))
        predictions = baseline.predict(pd.DataFrame(rows)[names])[.5] * 4
        baseline_forecasts[t.isoformat()] = np.maximum(0,predictions.reshape(len(ids),4).mean(axis=1)).round(5).tolist()
        errors.extend(np.abs(predictions-np.array(actuals)).tolist())
    sources.append({'source':'Causal household baseline inference','kind':'forecast','units':'kW','geography':'Mapped ResStock households','version':digest(ROOT/'artifacts/baseline/manifest.json'),
       'detail':'Only prior meter intervals and prior-hour weather; constant 50% cloud assumption. Cross-year weather alignment is modeled.'})
    body={'start':points[0]['at'],'end':'2024-08-21T05:00:00+00:00','points':points,'sources':sources,
          'modelHealth':{},'loadForecasts':forecasts,'loadValidation':scores,'baselineForecasts':baseline_forecasts,'baselineCausalMaeKw':float(np.mean(errors))}
    raw=json.dumps(body,sort_keys=True,allow_nan=False)
    body['version']=hashlib.sha256(raw.encode()).hexdigest()
    (OUT/'bundle.json').write_text(json.dumps(body,allow_nan=False))
    (OUT/'manifest.json').write_text(json.dumps({'sha256':digest(OUT/'bundle.json'),'sources':sources,'loadValidation':scores},indent=2))
    print(json.dumps({'points':len(points),'homes':len(ids),'loadValidation':scores},indent=2))

if __name__ == '__main__': main()
