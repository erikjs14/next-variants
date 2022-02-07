from datetime import date, datetime, timedelta
import os
import pytz

first_date_str = '2022-02-01'
today = datetime.now(pytz.timezone('Europe/Berlin'))

cur_date = today
while cur_date.strftime('%Y-%m-%d') >= first_date_str:
  cur_date_str = cur_date.strftime('%Y-%m-%d')
  os.environ['DTP'] = cur_date_str
  os.system('jupyter nbconvert --ExecutePreprocessor.timeout=500 --to notebook --execute update.ipynb')
  cur_date = cur_date + timedelta(-1)