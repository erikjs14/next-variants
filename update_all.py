from datetime import date, datetime, timedelta
import os
import pytz

first_date_str = '2021-12-01'
today = datetime.now(pytz.timezone('Europe/Berlin'))

cur_date = datetime.strptime(first_date_str, '%Y-%m-%d').date()
while cur_date.strftime('%Y-%m-%d') <= today.strftime('%Y-%m-%d'):
  cur_date_str = cur_date.strftime('%Y-%m-%d')
  os.environ['DTP'] = cur_date_str
  os.system('jupyter nbconvert --ExecutePreprocessor.timeout=500 --to notebook --execute update.ipynb')
  cur_date = cur_date + timedelta(1)
