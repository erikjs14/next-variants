import urllib.request
urllib.request.urlretrieve("https://github.com/robert-koch-institut/SARS-CoV-2-Sequenzdaten_aus_Deutschland/raw/master/SARS-CoV-2-Sequenzdaten_Deutschland.csv.xz", "meta.csv.xz")
urllib.request.urlretrieve("https://github.com/robert-koch-institut/SARS-CoV-2-Sequenzdaten_aus_Deutschland/raw/master/SARS-CoV-2-Entwicklungslinien_Deutschland.csv.xz", "variants.csv.xz")
urllib.request.urlretrieve("https://covid.ourworldindata.org/data/owid-covid-data.csv", "owid-covid-data.csv")

import os
os.system('xz -d -k meta.csv.xz')
os.system('xz -d -k variants.csv.xz')

import numpy as np
import pandas as pd

lineage_file='variants.csv'
meta_file = 'meta.csv'

lineage = pd.read_csv(lineage_file)
meta = pd.read_csv(meta_file)
data = pd.merge(lineage, meta, left_on='IMS_ID', right_on='IMS_ID', how='left')
data = data[data.SEQ_REASON.isin(['N'])] # filter for random samples

sdps = [] # single data points

len(data.index)

scorpios = data.scorpio_call.unique()
scorpios

alphabet = ['alpha', 'beta', 'eta', 'zeta', 'lambda', 'gamma', 'epsilon', 'theta', 'iota', 'epsilon', 'delta', 'mu', 'omicron']

data['variant'] = data.scorpio_call
for letter in alphabet:
    data['variant'] = data['variant'] \
        .mask(data['variant'] \
            .isin([s for s in list(scorpios) if letter in str(s).lower()]), 
            letter.capitalize()
        )

grouped_data = data.groupby(['DATE_DRAW', 'variant']).size()
grouped_data

"""### Group and calc relatives"""

agg_data_list = []
for date in data.DATE_DRAW.unique():
    if date not in grouped_data: continue
    total = 0
    entry = {'date': date}
    variant_sum = 0
    for variant in data.variant.unique():
        total += grouped_data[date, variant] if variant in grouped_data[date] else 0
        if str(variant).lower() not in alphabet: continue
        entry[str(variant).lower()] = grouped_data[date, variant] if variant in grouped_data[date] else 0
        variant_sum += entry[str(variant).lower()]
    for variant in data.variant.unique():
        if str(variant).lower() not in alphabet: continue
        entry[str(variant).lower() + '_rel'] = entry[str(variant).lower()] / total
    entry['other'] = total - variant_sum
    entry['other_rel'] = (total - variant_sum) / total
    entry['sum'] = total
    agg_data_list.append(entry)

agg_data = pd.DataFrame(agg_data_list)
agg_data.sort_values('date', axis=0, inplace=True)
agg_data.reset_index(drop=True, inplace=True)
agg_data

"""### Calc rolling averages"""

agg_data_rolling = agg_data.rolling(window=3).mean()
agg_data_rolling['date'] = agg_data['date']
agg_data_rolling.dropna(inplace=True)
agg_data_rolling

"""### Calc logarithmic fit"""

from scipy.optimize import curve_fit
import time
from datetime import date, timedelta
from functools import partial

def sigmoid(x, x0, k, max=1):
    y = max / (1 + np.exp(-k*(x-x0)))
    return (y)

def sigmoid_x(y, x0, k, max=1):
    return (x0 + np.log(1/y - 1) / (-k)) / max


def fit(df, col, f, start='2021-01-01', end=None, add_days=None, method='lm'):

    if start: df_tmp = df[df.date >= start]
    if end and type(end) == str: df_tmp = df[df.date <= end]
    elif end and type(end) == int: df_tmp = df_tmp.iloc[:end]

    xdata = df_tmp.index # should use date
    ydata = df_tmp[col]

    p0 = [np.median(xdata),1] # this is an mandatory initial guess

    popt, pcov = curve_fit(f, xdata, ydata,p0, method=method, maxfev=10000000000)
    
    df_out = pd.DataFrame({'date': df.date})
    df_out.index = df.index
    
    if add_days:
        last_day = time.strptime(df.iloc[-1]['date'], '%Y-%m-%d')
        for i in range(add_days):
            day_str = (date(last_day.tm_year, last_day.tm_mon, last_day.tm_mday) + timedelta(i+1)).strftime('%Y-%m-%d')
            df_out = df_out.append({'date': day_str}, ignore_index=True)
            
    df_out['fit'] = f(df_out.index, *popt)

    return df_out, popt

delta_growth_fit, popt_dgf = fit(agg_data, 'delta_rel', sigmoid, '2021-02-15', '2021-11-01', method='dogbox')
omicron_growth_fit, popt_ogf = fit(agg_data, 'omicron_rel', sigmoid, '2021-11-01', -3, 50, method='dogbox')

delta_vs_omicron_offset = -200 # days

"""### Daily new cases"""

owid_data = pd.read_csv('owid-covid-data.csv')
owid_data_ger = owid_data[owid_data.iso_code == 'DEU']
owid_data_ger.head()

abs_data = agg_data_rolling[['date','delta_rel','omicron_rel']]
abs_data = abs_data[abs_data.date >= '2021-11-23'] # from 11/23 omicron started to appear

abs_data = pd.merge(abs_data, owid_data_ger[['date', 'new_cases_smoothed']], on='date', how='inner')

abs_data['delta_abs'] = abs_data['delta_rel'] * abs_data['new_cases_smoothed']
abs_data['omicron_abs'] = abs_data['omicron_rel'] * abs_data['new_cases_smoothed']

abs_data

from functools import partial

forecast_days = 40

delta_abs_fit, popt_daf = fit(abs_data, 'delta_abs', partial(sigmoid, max=abs_data.delta_abs.max()), add_days=forecast_days, method='dogbox')

def exp(x, A, b):
  return A * np.exp(b * x)

omicron_abs_fit, popt_oaf = fit(abs_data, 'omicron_abs', exp, add_days=forecast_days, method='trf')

abs_data_fit = pd.concat([abs_data, delta_abs_fit[['fit']].rename({'fit': 'delta_abs_fit'}, axis=1)], axis=1)
abs_data_fit = pd.concat([abs_data_fit, omicron_abs_fit[['fit']].rename({'fit': 'omicron_abs_fit'}, axis=1)], axis=1)
abs_data_fit['new_cases_smoothed_fit'] = abs_data_fit['delta_abs_fit'] + abs_data_fit['omicron_abs_fit']
abs_data_fit.loc[len(abs_data.index):, 'date'] = pd.date_range(abs_data.iloc[-1].date, periods=forecast_days+1)[1:].map(lambda d: d.strftime('%Y-%m-%d'))

abs_data_fit = abs_data_fit.join(omicron_growth_fit.set_index('date').rename({'fit': 'omicron_rel_fit'}, axis=1), on='date', how='left')
data_fit = abs_data_fit

abs_data_fit

# project omicron 50% and 100% (>99%)
def project_omicron_above(p, popt):
  df = pd.DataFrame({'date': agg_data.date})
  df.index = agg_data.index

  idx_above = int(np.ceil(sigmoid_x(p, *popt)))

  if idx_above in df.index:
    return df.loc[idx_above].date
  
  diff = idx_above - df.index.max()
  last_day = time.strptime(df.iloc[-1]['date'], '%Y-%m-%d')
  return (date(last_day.tm_year, last_day.tm_mon, last_day.tm_mday) + timedelta(diff)).strftime('%Y-%m-%d')

# single data points
sdps = []

# Reproduction Rate alltogether
sdps.append({
    'label': 'Reproduktionsrate',
    'value': owid_data_ger.reproduction_rate.dropna().iloc[-1],
    'hint': 'R-Wert gesamt'
})

# Share of variants
sdps.append({
    'label': 'Anteil Omikron (' + str(agg_data_rolling.iloc[-1].date) + ')',
    'value': '{:.2f}%'.format(agg_data_rolling.iloc[-1].omicron_rel*100),
    'hint': '3-Tagesdurchschnitt des relativen Anteils der Omikron-Variante an den Gesamtinfektionen. Stand: ' + agg_data_rolling.iloc[-1].date
})
sdps.append({
    'label': 'Anteil Delta (' + str(agg_data_rolling.iloc[-1].date) + ')',
    'value': '{:.2f}%'.format(agg_data_rolling.iloc[-1].delta_rel*100),
    'hint': '3-Tagesdurchschnitt des relativen Anteils der Delta-Variante an den Gesamtinfektionen. Stand: ' + agg_data_rolling.iloc[-1].date
})

dft = data_fit[data_fit.date == date.today().strftime('%Y-%m-%d')]
sdps.append({
    'label': 'Nowcast Anteil Omikron',
    'value': round(dft.omicron_abs_fit.iloc[0] / dft.new_cases_smoothed_fit.iloc[0], 4),
    'hint': 'Projektion Anteil Omikron heute'
})
sdps.append({
    'label': 'Nowcast Anteil Delta',
    'value': round(dft.delta_abs_fit.iloc[0] / dft.new_cases_smoothed_fit.iloc[0], 4),
    'hint': 'Projektion Anteil Delta heute'
})

sdps.append({
    'label': 'Projektion Omikron 50%',
    'value': project_omicron_above(0.5, popt_ogf),
    'hint': 'Projektion für Omikron-Anteil > 50%'
})
sdps.append({
    'label': 'Projektion Omikron 95%',
    'value': project_omicron_above(0.95, popt_ogf),
    'hint': 'Projektion für Omikron-Anteil > 95%'
})

one_week = (date.today() + timedelta(7)).strftime('%Y-%m-%d')
one_week_idx = data_fit[data_fit.date == one_week].index.item()
two_weeks = (date.today() + timedelta(14)).strftime('%Y-%m-%d')
two_weeks_idx = data_fit[data_fit.date == two_weeks].index.item()
sdps.append({
    'label': 'Projektion Omikron Fallzahlen in 14 Tagen',
    'value': round(data_fit[data_fit.date == two_weeks].omicron_abs_fit.iloc[0]),
    'hint': 'Projektion für Omikron-Fallzahlen in 14 Tagen.'
})
sdps.append({
    'label': 'Projektion Delta Fallzahlen in 14 Tagen',
    'value': round(data_fit[data_fit.date == two_weeks].delta_abs_fit.iloc[0]),
    'hint': 'Projektion für Delta-Fallzahlen in 14 Tagen.'
})

sdps.append({
    'label': 'Projektion 7-Tage-Inzidenz in 14 Tagen',
    'value': str(round((data_fit.new_cases_smoothed_fit.iloc[one_week_idx:two_weeks_idx+1].sum()/83240000)*100000, 2)),
    'hint': '',
})

cur_idx = data_fit[data_fit.date == (date.today() - timedelta(1)).strftime('%Y-%m-%d')].index[0]
last_cases = data_fit.loc[cur_idx, 'new_cases_smoothed_fit']
cur_idx += 1
while cur_idx <= data_fit.index.max() and last_cases >= data_fit.loc[cur_idx, 'new_cases_smoothed_fit']:
  cur_idx += 1

if cur_idx <= data_fit.index.max():
  sdps.append({
      'label': 'Steigende Fälle ab',
      'value': data_fit.loc[cur_idx, 'date'],
      'hint': 'Datum, ab welchem Fallzahlen wieder steigen (Projektion)'
  })

sdps

import json
    
os.system('mkdir -p data/growth_fit')

agg_data.to_csv('data/agg_data.csv', index=False)
agg_data_rolling.to_csv('data/agg_data_rolling.csv', index=False)

delta_growth_fit.to_csv('data/growth_fit/delta.csv', index=False)
omicron_growth_fit.iloc[:-14].to_csv('data/growth_fit/omicron.csv', index=False)

data_fit.to_csv('data/projection.csv', index=False)

with open("data/sdps.json", "w") as fp:
    json.dump(sdps , fp)

os.system('rm meta.csv')
os.system('rm meta.csv.xz')
os.system('rm variants.csv')
os.system('rm variants.csv.xz')

agg_data