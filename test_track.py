import time
from collections import deque
from threading import Lock

class TelemetryTracker:
    def __init__(self):
        self.lock = Lock()
        self.buckets = deque([0]*24, maxlen=24)
        self.last_update = time.time()
        
    def record(self):
        with self.lock:
            now = time.time()
            # 1 hour bucket for example, or 1 minute buckets.
            # Sparkline has 24 points. Let's say each bucket is 5 minutes? 24 * 5 = 120 minutes.
            # The UI says 00:00 -> 06:00 -> 12:00 -> 18:00 -> Now which implies 24 hours = 1 hour bins.
            bin_size = 3600
            diff = int((now - self.last_update) / bin_size)
            if diff > 0:
                for _ in range(min(diff, 24)):
                    self.buckets.append(0)
                self.last_update = now
            self.buckets[-1] += 1
            
    def get_data(self):
        with self.lock:
            self.record() # update time bins
            self.buckets[-1] -= 1 # un-record the get_data hit? Or not.
            return list(self.buckets)
