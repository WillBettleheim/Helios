import sys
sys.path.insert(0, 'src')
from monitoring.health_monitor import HealthMonitor
import pandas as pd

def main():
    print("=== HELIOS Feature Verification ===")
    monitor = HealthMonitor()
    monitor.initialize()
    astronauts = monitor.get_astronaut_list()
    if not astronauts:
        print("ERROR: No astronauts loaded")
        return
    astronaut_id = astronauts[0]['astronaut_id']
    print(f"Using astronaut: {astronaut_id} ({astronauts[0]['name']})")
    monitor.set_astronaut(astronaut_id)

    # 1. Astronaut switching
    print("\n1. Astronaut switching:")
    names = [a['name'] for a in astronauts]
    print(f"Available astronauts: {names}")
    for a in astronauts:
        monitor.set_astronaut(a['astronaut_id'])
        if monitor.current_astronaut == a['astronaut_id']:
            print(f"  -> Switched to {a['name']} OK")
        else:
            print(f"  -> FAILED to switch to {a['name']}")

    # 2. Model loading
    print("\n2. Model info:")
    model_info = monitor.get_model_info()
    print(f"   Model loaded: {model_info.get('model_loaded')}")
    if model_info.get('model_loaded'):
        print(f"   Is trained: {model_info.get('is_trained')}")
        print(f"   Contamination: {model_info.get('contamination')}")
        print(f"   Feature names: {model_info.get('feature_names')}")
    else:
        print("   ERROR: Model not loaded")
        return

    # 3. Get latest metrics
    print("\n3. Latest metrics:")
    latest = monitor.get_latest_metrics(astronaut_id, 1)
    if latest is not None and not latest.empty:
        print(f"   Latest timestamp: {latest['timestamp'].iloc[0]}")
        metrics = ['heart_rate', 'blood_oxygen', 'systolic_bp', 'diastolic_bp', 'body_temp',
                   'sleep_duration', 'sleep_quality', 'physical_activity', 'stress_level', 'mood_score']
        for m in metrics:
            if m in latest.columns:
                val = latest[m].iloc[0]
                print(f"   {m}: {val}")
            else:
                print(f"   {m}: MISSING")
    else:
        print("   ERROR: No latest metrics")

    # 4. Health Risk Index
    print("\n4. Health Risk Index (HRI):")
    hri = monitor.compute_health_risk_index(astronaut_id)
    if hri:
        print(f"   Score: {hri['risk_score']} / 100")
        print(f"   Severity: {hri['severity']}")
    else:
        print("   ERROR: HRI computation failed")

    # 5. Anomaly detection and explanations
    print("\n5. Anomaly detection (last 120 days to ensure anomalies):")
    anomaly_results = monitor.detect_anomalies(astronaut_id, days=120)
    if anomaly_results and 'anomaly_results' in anomaly_results:
        anomaly_flags = anomaly_results['anomaly_results']['is_anomaly_bool']
        count = anomaly_flags.sum()
        print(f"   Anomalies detected: {count} / {len(anomaly_flags)}")
        if count > 0:
            explanations = anomaly_results['anomaly_results'].get('explanations', [])
            print(f"   Explanations available: {len(explanations)}")
            if explanations:
                exp = explanations[0]
                print(f"   First explanation timestamp: {exp.get('timestamp')}")
                print(f"   Anomaly score: {exp.get('anomaly_score')}")
                contributors = exp.get('top_contributors', [])
                print(f"   Top contributors: {len(contributors)}")
                for c in contributors[:2]:
                    print(f"     - {c.get('description', 'N/A')}")
            else:
                print("   WARNING: No explanations despite anomalies")
        else:
            print("   INFO: No anomalies in the selected window")
    else:
        print("   ERROR: Anomaly detection failed")

    # 6. Alerts
    print("\n6. Alerts:")
    alerts = monitor.get_active_alerts(astronaut_id)
    print(f"   Active alerts count: {len(alerts)}")
    if alerts:
        for alert in alerts[:3]:
            print(f"   - {alert['name']} ({alert['severity']}): {alert['value']} {alert.get('metric', '')}_unit")
    else:
        print("   INFO: No active alerts")

    # 7. Longitudinal analysis
    print("\n7. Longitudinal analysis (heart_rate, 30 days):")
    analysis = monitor.get_longitudinal_analysis(astronaut_id, metric='heart_rate', days=30)
    if analysis:
        print(f"   Data points: {len(analysis['timestamps'])}")
        print(f"   Baseline mean: {analysis['baseline_mean']:.2f}")
        print(f"   Baseline std: {analysis['baseline_std']:.2f}")
        print(f"   Percent sustained change: {analysis['percent_sustained']}%")
    else:
        print("   ERROR: Longitudinal analysis failed")

    # 8. Data quality
    print("\n8. Data quality summary:")
    quality = monitor.get_data_quality_summary(astronaut_id)
    if quality:
        print(f"   Total records: {quality.get('total_records')}")
        print(f"   Quality distribution: {quality.get('quality_distribution')}")
        print(f"   Date range: {quality.get('date_range')}")
    else:
        print("   ERROR: Could not get data quality summary")

    print("\n=== Verification complete ===")

if __name__ == '__main__':
    main()