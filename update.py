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
alphabet_lineage = ['BA.1', 'BA.2', 'BA.3']
lineage_map = {
    'BA.1': 'ba1',
    'BA.2': 'ba2',
    'BA.3': 'ba3',
}

data['variant'] = data.scorpio_call
for letter in alphabet:
    data['variant'] = data['variant'] \
        .mask(data['variant'] \
            .isin([s for s in list(scorpios) if letter in str(s).lower()]), 
            letter.capitalize()
        )

# add sub-lineage BA.1.1 to BA.1
data.loc[data.lineage == 'BA.1.1', 'lineage'] = 'BA.1'

grouped_data = data.groupby(['DATE_DRAW', 'variant']).size()
grouped_data_lineage = data.groupby(['DATE_DRAW', 'lineage']).size()
daily_totals = data.groupby('DATE_DRAW').size()

"""### Group and calc relatives"""

agg_data_list = []
for date in data.DATE_DRAW.unique():
    if date not in grouped_data and date not in grouped_data_lineage: continue
    total = daily_totals[date]
    entry = {'date': date}
    variant_sum = 0
    for variant in data.variant.unique():
        if str(variant).lower() not in alphabet: continue
        entry[str(variant).lower()] = grouped_data[date, variant] if date in grouped_data and variant in grouped_data[date] else 0
        variant_sum += entry[str(variant).lower()]
    for variant in data.variant.unique():
        if str(variant).lower() not in alphabet: continue
        entry[str(variant).lower() + '_rel'] = entry[str(variant).lower()] / total
    entry['other'] = total - variant_sum
    entry['other_rel'] = (total - variant_sum) / total
    entry['sum'] = total

    # separately count omicron lineages
    for lineage in alphabet_lineage:
      entry[lineage_map[lineage]] = grouped_data_lineage[date, lineage] if date in grouped_data_lineage and lineage in grouped_data_lineage[date] else 0
      entry[lineage_map[lineage] + '_rel'] = entry[lineage_map[lineage]] / total
    
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


def fit(df, col, f, start='2021-01-01', end=None, add_days=None, method='lm', p0=None):

    if start: df_tmp = df[df.date >= start]
    if end and type(end) == str: df_tmp = df[df.date <= end]
    elif end and type(end) == int: df_tmp = df_tmp.iloc[:end]

    xdata = df_tmp.index # should use date
    ydata = df_tmp[col]

    if not p0:
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

delta_growth_fit, popt_dgf = fit(agg_data, 'delta_rel', sigmoid, '2021-02-15', '2021-11-01', method='dogbox', p0=[1.76120820e+02, 1.24058886e-01])
omicron_growth_fit, popt_ogf = fit(agg_data, 'omicron_rel', sigmoid, '2021-11-01', -3, 50, method='dogbox') #, p0=[3.69856596e+02, 1.45054351e-01])
ba1_growth_fit, popt_ba1gf = fit(agg_data, 'ba1_rel', sigmoid, '2021-11-01', -3, 50, method='dogbox')
ba2_growth_fit, popt_ba2gf = fit(agg_data, 'ba2_rel', sigmoid, '2021-12-20', -3, 50, method='dogbox')

delta_vs_omicron_offset = -200 # days

"""### Daily new cases"""

owid_data = pd.read_csv('owid-covid-data.csv')
owid_data_ger = owid_data[owid_data.iso_code == 'DEU']
owid_data_ger.head()

abs_data = agg_data_rolling[['date','delta_rel','omicron_rel', 'ba1_rel', 'ba2_rel']]
abs_data = abs_data[abs_data.date >= '2021-11-23'] # from 11/23 omicron started to appear

abs_data = pd.merge(abs_data, owid_data_ger[['date', 'new_cases_smoothed']], on='date', how='inner')

abs_data['delta_abs'] = abs_data['delta_rel'] * abs_data['new_cases_smoothed']
abs_data['omicron_abs'] = abs_data['omicron_rel'] * abs_data['new_cases_smoothed']
abs_data['ba1_abs'] = abs_data['ba1_rel'] * abs_data['new_cases_smoothed']
abs_data['ba2_abs'] = abs_data['ba2_rel'] * abs_data['new_cases_smoothed']

abs_data

from functools import partial

forecast_days = 28

delta_abs_fit, popt_daf = fit(abs_data, 'delta_abs', partial(sigmoid, max=abs_data.delta_abs.max()), add_days=forecast_days, method='dogbox', p0=[29.41586688, -0.1227476 ])

def exp(x, A, b):
  return A * np.exp(b * x)

omicron_abs_fit, popt_oaf = fit(abs_data, 'omicron_abs', exp, add_days=forecast_days, method='trf', p0=[4.05931889e+02, 9.54850414e-02])
ba1_abs_fit, popt_ba1af = fit(abs_data, 'ba1_abs', exp, add_days=forecast_days, method='trf', p0=[4.05931889e+02, 9.54850414e-02])
ba2_abs_fit, popt_ba2af = fit(abs_data, 'ba2_abs', exp, add_days=forecast_days, method='trf', p0=[4.05931889e+02, 9.54850414e-02])

abs_data_fit = pd.concat([abs_data, delta_abs_fit[['fit']].rename({'fit': 'delta_abs_fit'}, axis=1)], axis=1)
abs_data_fit = pd.concat([abs_data_fit, omicron_abs_fit[['fit']].rename({'fit': 'omicron_abs_fit'}, axis=1)], axis=1)
abs_data_fit = pd.concat([abs_data_fit, ba1_abs_fit[['fit']].rename({'fit': 'ba1_abs_fit'}, axis=1)], axis=1)
abs_data_fit = pd.concat([abs_data_fit, ba2_abs_fit[['fit']].rename({'fit': 'ba2_abs_fit'}, axis=1)], axis=1)
abs_data_fit['new_cases_smoothed_fit'] = abs_data_fit['delta_abs_fit'] + abs_data_fit['omicron_abs_fit']
abs_data_fit.loc[len(abs_data.index):, 'date'] = pd.date_range(abs_data.iloc[-1].date, periods=forecast_days+1)[1:].map(lambda d: d.strftime('%Y-%m-%d'))

# abs_data_fit = abs_data_fit.join(omicron_growth_fit.set_index('date').rename({'fit': 'omicron_rel_fit'}, axis=1), on='date', how='left')
abs_data_fit['omicron_rel_fit'] = abs_data_fit.omicron_abs_fit / abs_data_fit.new_cases_smoothed_fit
abs_data_fit['ba1_rel_fit'] = abs_data_fit.ba1_abs_fit / abs_data_fit.new_cases_smoothed_fit
abs_data_fit['ba2_rel_fit'] = abs_data_fit.ba2_abs_fit / abs_data_fit.new_cases_smoothed_fit
abs_data_fit['delta_rel_fit'] = abs_data_fit.delta_abs_fit / abs_data_fit.new_cases_smoothed_fit

for _, row in owid_data_ger.iterrows():
  if row.date in abs_data_fit.date.unique():
    idx = abs_data_fit[abs_data_fit.date == row.date].index.item()
    abs_data_fit.loc[idx, 'new_cases_smoothed'] = row.new_cases_smoothed

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

def get_yesterdays_value(label, sdps):
  if sdps is None: return None
  return next((sdp['value_raw'] for sdp in sdps if sdp['label'] == label and 'value_raw' in sdp), None)

def get_diff_str(after, before, round_to=2):
  diff = float(after) - float(before)
  if diff >= 0: return f'+{round(diff, round_to)}'
  else: return f'{round(diff, round_to)}'

# load yesterday's sdps
try:
    print('trying to open')
    yesterday_str = (date.today() + timedelta(-1)).strftime('%Y-%m-%d')
    with open(f'./data/historic/sdps/{yesterday_str}.json', 'r') as f:
        sdps_yesterday = json.load(f)
except:
    sdps_yesterday = None
    print('exception')
    
print({'1': yesterday_str, '2': sdps_yesterday})

# Reproduction Rate alltogether
label = 'R-Wert (' + str(owid_data_ger[['date', 'reproduction_rate']].dropna().iloc[-1].date) + ')'
value_raw = owid_data_ger.reproduction_rate.dropna().iloc[-1]
val_y = get_yesterdays_value(label, sdps_yesterday)
sdps.append({
    'label': label,
    'value': value_raw,
    'value_raw': value_raw,
    'hint': 'Kann nur nachhängig gemessen werden. R-Wert gesamt vom ' + str(owid_data_ger[['date', 'reproduction_rate']].dropna().iloc[-1].date),
    'change': get_diff_str(value_raw, val_y) if val_y is not None else None,
})

label = '7-Tage-Inzidenz'
value_raw = owid_data_ger.iloc[-1].new_cases_smoothed_per_million/10 * 7
val_y = get_yesterdays_value(label, sdps_yesterday)
sdps.append({
    'label': label,
    'value': '{:.2f}'.format(value_raw),
    'value_raw': value_raw,
    'hint': 'Inzidenz mit Stand ' + owid_data_ger.iloc[-1].date,
    'change': get_diff_str(value_raw, val_y) if val_y is not None else None,
})

label = 'Verdopplungszeit'
value_raw = np.log(2) / np.log(1 + ((data_fit.iloc[-1]['new_cases_smoothed_fit'] - data_fit.iloc[-2]['new_cases_smoothed_fit']) / data_fit.iloc[-2]['new_cases_smoothed_fit']))
val_y = get_yesterdays_value(label, sdps_yesterday)
sdps.append({
    'label': label,
    'value': '{:.1f} Tage'.format(value_raw),
    'value_raw': value_raw,
    'hint': 'Verdopplungszeit der Fallzahlen auf Basis des aktuellen Wachstums.',
    'change': get_diff_str(value_raw, val_y) if val_y is not None else None,
})
value_raw = int(owid_data_ger.iloc[-1].new_cases)
sdps.append({
    'label': 'Neue Fälle gestern',
    'value': value_raw,
    'value_raw': value_raw,
    'hint': 'Neue gemeldete Fälle gestern, ' + owid_data_ger.iloc[-1].date,
    'change': None,
})

# Share of variants
value_raw = agg_data_rolling.iloc[-1].omicron_rel*100
sdps.append({
    'label': 'Anteil Omikron (' + str(agg_data_rolling.iloc[-1].date) + ')',
    'value': '{:.2f}%'.format(value_raw),
    'value_raw': value_raw,
    'hint': '3-Tagesdurchschnitt des relativen Anteils der Omikron-Variante an den Gesamtinfektionen. Stand: ' + agg_data_rolling.iloc[-1].date,
    'change': None,
})
value_raw = agg_data_rolling.iloc[-1].ba1_rel*100
sdps.append({
    'label': 'Anteil BA.1 (' + str(agg_data_rolling.iloc[-1].date) + ')',
    'value': '{:.2f}%'.format(value_raw),
    'value_raw': value_raw,
    'hint': '3-Tagesdurchschnitt des relativen Anteils des Omikron-Subtyps BA.1 an den Gesamtinfektionen. Stand: ' + agg_data_rolling.iloc[-1].date,
    'change': None,
})
value_raw = agg_data_rolling.iloc[-1].ba2_rel*100
sdps.append({
    'label': 'Anteil BA.2 (' + str(agg_data_rolling.iloc[-1].date) + ')',
    'value': '{:.2f}%'.format(value_raw),
    'value_raw': value_raw,
    'hint': '3-Tagesdurchschnitt des relativen Anteils des Omikron-Subtyps BA.2 an den Gesamtinfektionen. Stand: ' + agg_data_rolling.iloc[-1].date,
    'change': None,
})
value_raw = agg_data_rolling.iloc[-1].delta_rel*100
sdps.append({
    'label': 'Anteil Delta (' + str(agg_data_rolling.iloc[-1].date) + ')',
    'value': '{:.2f}%'.format(value_raw),
    'value_raw': value_raw,
    'hint': '3-Tagesdurchschnitt des relativen Anteils der Delta-Variante an den Gesamtinfektionen. Stand: ' + agg_data_rolling.iloc[-1].date,
    'change': None,
})

dft = data_fit[data_fit.date == date.today().strftime('%Y-%m-%d')]
value_raw = 100 * dft.omicron_abs_fit.iloc[0] / dft.new_cases_smoothed_fit.iloc[0]
sdps.append({
    'label': 'Nowcast Anteil Omikron',
    'value': '{:.2f}%'.format(value_raw),
    'value_raw': value_raw,
    'hint': 'Projektion Anteil Omikron heute',
    'change': None,
})
value_raw = 100 * dft.delta_abs_fit.iloc[0] / dft.new_cases_smoothed_fit.iloc[0]
sdps.append({
    'label': 'Nowcast Anteil Delta',
    'value': '{:.2f}%'.format(value_raw),
    'value_raw': value_raw,
    'hint': 'Projektion Anteil Delta heute',
    'change': None,
})

# value_raw = project_omicron_above(0.5, popt_ogf)
# sdps.append({
#     'label': 'Projektion Omikron 50%',
#     'value': value_raw,
#     'value_raw': value_raw,
#     'hint': 'Projektion für Omikron-Anteil > 50%',
#     'change': None,
# })
# value_raw = project_omicron_above(0.9, popt_ogf)
# sdps.append({
#     'label': 'Projektion Omikron 90%',
#     'value': value_raw,
#     'value_raw': value_raw,
#     'hint': 'Projektion für Omikron-Anteil > 90%',
#     'change': None,
# })
# value_raw = project_omicron_above(0.95, popt_ogf)
# sdps.append({
#     'label': 'Projektion Omikron 95%',
#     'value': value_raw,
#     'value_raw': value_raw,
#     'hint': 'Projektion für Omikron-Anteil > 95%',
#     'change': None,
# })
# value_raw = project_omicron_above(0.99, popt_ogf)
# sdps.append({
#     'label': 'Projektion Omikron 99%',
#     'value': value_raw,
#     'value_raw': value_raw,
#     'hint': 'Projektion für Omikron-Anteil > 99%',
#     'change': None,
# })

today_idx = data_fit[data_fit.date == date.today().strftime('%Y-%m-%d')].index.item()
one_week = (date.today() + timedelta(7)).strftime('%Y-%m-%d')
one_week_idx = data_fit[data_fit.date == one_week].index.item()
two_weeks = (date.today() + timedelta(14)).strftime('%Y-%m-%d')
two_weeks_idx = data_fit[data_fit.date == two_weeks].index.item()
three_weeks = (date.today() + timedelta(21)).strftime('%Y-%m-%d')
three_weeks_idx = data_fit[data_fit.date == three_weeks].index.item()

value_raw = data_fit[data_fit.date == two_weeks].omicron_abs_fit.iloc[0]
sdps.append({
    'label': 'Projektion Omikron Fallzahlen in 14 Tagen',
    'value': round(value_raw),
    'value_raw': value_raw,
    'hint': 'Projektion für Omikron-Fallzahlen in 14 Tagen basierend auf aktuellem Wachstum.',
    'change': None,
})
value_raw = data_fit[data_fit.date == two_weeks].delta_abs_fit.iloc[0]
sdps.append({
    'label': 'Projektion Delta Fallzahlen in 14 Tagen',
    'value': round(value_raw),
    'value_raw': value_raw,
    'hint': 'Projektion für Delta-Fallzahlen in 14 Tagen basierend auf aktuellem Wachstum.',
    'change': None,
})

value_raw = (data_fit.new_cases_smoothed_fit.iloc[today_idx:one_week_idx+1].sum()/83240000)*100000
sdps.append({
    'label': 'Projektion 7-Tage-Inzidenz in 7 Tagen',
    'value': str(round(value_raw, 2)),
    'value_raw': value_raw,
    'hint': 'Basierend auf aktuellem Wachstum. Davon Delta: {:.2f}%, Omikron: {:.2f}%'.format(100 * data_fit.delta_rel_fit.iloc[one_week_idx], 100 * data_fit.omicron_rel_fit.iloc[one_week_idx]),
    'change': None,
})
# value_raw = (data_fit.new_cases_smoothed_fit.iloc[one_week_idx:two_weeks_idx+1].sum()/83240000)*100000
# sdps.append({
#     'label': 'Projektion 7-Tage-Inzidenz in 14 Tagen',
#     'value': str(round(value_raw, 2)),
#     'value_raw': value_raw,
#     'hint': 'Basierend auf aktuellem Wachstum. Davon Delta: {:.2f}%, Omikron: {:.2f}%'.format(100 * data_fit.delta_rel_fit.iloc[two_weeks_idx], 100 * data_fit.omicron_rel_fit.iloc[two_weeks_idx]),
#     'change': None,
# })
# value_raw = (data_fit.new_cases_smoothed_fit.iloc[two_weeks_idx:three_weeks_idx+1].sum()/83240000)*100000
# sdps.append({
#     'label': 'Projektion 7-Tage-Inzidenz in 21 Tagen',
#     'value': str(round(value_raw, 2)),
#     'value_raw': value_raw,
#     'hint': 'Basierend auf aktuellem Wachstum. Davon Delta: {:.2f}%, Omikron: {:.2f}%'.format(100 * data_fit.delta_rel_fit.iloc[three_weeks_idx], 100 * data_fit.omicron_rel_fit.iloc[three_weeks_idx]),
#     'change': None,
# })

# cur_idx = 0
# last_cases = data_fit.loc[cur_idx, 'new_cases_smoothed_fit']
# cur_idx += 1
# while cur_idx <= data_fit.index.max() and last_cases >= data_fit.loc[cur_idx, 'new_cases_smoothed_fit']:
#   last_cases = data_fit.loc[cur_idx, 'new_cases_smoothed_fit']
#   cur_idx += 1

# if cur_idx <= data_fit.index.max():
#   value_raw = data_fit.loc[cur_idx, 'date']
#   sdps.append({
#       'label': 'Steigende Fälle ab',
#       'value': value_raw,
#       'value_raw': value_raw,
#       'hint': 'Datum, ab welchem Fallzahlen wieder steigen (Projektion)',
#       'change': None,
#   })

sdps

import json
    
os.system('mkdir -p data/growth_fit')
os.system('mkdir -p data/historic/sdps')

agg_data.to_csv('data/agg_data.csv', index=False)
agg_data_rolling.to_csv('data/agg_data_rolling.csv', index=False)

delta_growth_fit.to_csv('data/growth_fit/delta.csv', index=False)
omicron_growth_fit.iloc[:-14].to_csv('data/growth_fit/omicron.csv', index=False)
ba1_growth_fit.iloc[:-14].to_csv('data/growth_fit/ba1.csv', index=False)
ba2_growth_fit.iloc[:-14].to_csv('data/growth_fit/ba2.csv', index=False)

data_fit.to_csv('data/projection.csv', index=False)

with open("data/sdps.json", "w") as fp:
    json.dump(sdps , fp) 
today_str = date.today().strftime('%Y-%m-%d')
with open(f'data/historic/sdps/{today_str}.json', 'w') as fp:
    json.dump(sdps, fp)

os.system('rm meta.csv')
os.system('rm meta.csv.xz')
os.system('rm variants.csv')
os.system('rm variants.csv.xz')

agg_data
