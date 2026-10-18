
import pandas as pd
import numpy as np
from src.monitoring.health_monitor import HealthMonitor
import os

def test_repro():
    monitor = HealthMonitor()
    monitor.initialize()

    astronauts = monitor.get_astronaut_list()
    if not astronauts:
        print("No astronauts found")
        return

    astronaut_id = astronauts[0]['astronaut_id']
    monitor.set_astronaut(astronaut_id)

    print(f"Testing for astronaut: {astronaut_id}")

    # 1. Test anomaly explanations timestamp
    anomaly_results = monitor.detect_anomalies(astronaut_id, days=120) # Use more days to ensure we hit an anomaly
    if anomaly_results and 'anomaly_results' in anomaly_results:
        explanations = anomaly_results['anomaly_results']['explanations']
        if explanations:
            exp = explanations[0]
            print(f"Timestamp type: {type(exp['timestamp'])}")
            try:
                print(f"Timestamp strftime: {exp['timestamp'].strftime('%Y-%m-%d %H:%M')}")
            except Exception as e:
                print(f"Timestamp strftime failed: {e}")
        else:
            print("No anomalies found to test explanations")

    # 2. Test metric timeline call
    data = monitor.get_time_range_data(astronaut_id, days=7)
    if data is not None and not data.empty:
        latest = data.iloc[0]
        metrics = {
            'Heart Rate': (latest['heart_rate'], 'bpm'),
        }
        metric = 'Heart Rate'
        try:
            val = metrics[metric][0]
            print(f"Metric value type: {type(val)}")
            call_val = val.lower().replace(' ', '_')
            print(f"Call value: {call_val}")
        except Exception as e:
            print(f"Metric timeline call failed: {e}")

if __name__ == "__main__":
    test_repro()
