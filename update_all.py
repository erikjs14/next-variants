from datetime import date, datetime, timedelta
import os
import pytz

first_date_str = '2022-02-01'
today = datetime.now(pytz.timezone('Europe/Berlin'))

cur_date = today
while cur_date.strftime('%Y-%m-%d') >= first_date_str:
  os.system(f'EXPORT DTP={cur_date.strftime('%Y-%m-%d')}')
  os.system('jupyter nbconvert --ExecutePreprocessor.timeout=500 --execute update.ipynb')
  cur_date = cur_date + timedelta(-1)