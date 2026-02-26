import schedule
import time
from trainer import retrain

def job():

    retrain()

schedule.every(24).hours.do(job)

while True:

    schedule.run_pending()

    time.sleep(60)
