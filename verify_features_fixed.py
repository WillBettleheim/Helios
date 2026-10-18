import sys
sys.path.insert(0, 'src')
from monitoring.health_monitor import HealthMonitor
import pandas as pd

def main():
    # We'll write the output to a string and then print it at the end to avoid encoding issues in the console
    output_lines = []
    def out(s):
        output_lines.append(s)

    out("=== HELIOS Feature Verification ===")
    monitor = HealthMonitor()
    monitor.initialize()
    astronauts = monitor.get_astronaut_list()
    if not astronauts:
        out("ERROR: No astronauts loaded")
        return
    astronaut_id = astronauts[0]['astronaut_id']
    out(f"Using astronaut: {astronaut_id} ({astronauts[0]['name']})")
    monitor.set_astronaut(astronaut_id)

    # 1. Astronaut switching
    out("\n1. Astronaut switching:")
    names = [a['name'] for a in astronauts]
    out(f"Available astronauts: {names}")
    for a in astronauts:
        monitor.set_astronaut(a['astronaut_id'])
        if monitor.current_astronaut == a['astronaut_id']:
            out(f"  -> Switched to {a['name']} OK")
        else:
            out(f"  -> FAILED to switch to {a['name']}")

    # 2. Model loading
    out("\n2. Model info:")
    model_info = monitor.get_model_info()
    out(f"   Model loaded: {model_info.get('model_loaded')}")
    if model_info.get('model_loaded'):
        out(f"   Is trained: {model_info.get('is_trained')}")
        out(f"   Contamination: {model_info.get('contamination')}")
        out(f"   Feature names: {model_info.get('feature_names')}")
    else:
        out("   ERROR: Model not loaded")
        return

    # 3. Get latest metrics
    out("\n3. Latest metrics:")
    latest = monitor.get_latest_metrics(astronaut_id, 1)
    if latest is not None and not latest.empty:
        out(f"   Latest timestamp: {latest['timestamp'].iloc[0]}")
        metrics = ['heart_rate', 'blood_oxygen', 'systolic_bp', 'diastolic_bp', 'body_temp',
                   'sleep_duration', 'sleep_quality', 'physical_activity', 'stress_level', 'mood_score']
        for m in metrics:
            if m in latest.columns:
                val = latest[m].iloc[0]
                out(f"   {m}: {val}")
            else:
                out(f"   {m}: MISSING")
    else:
        out("   ERROR: No latest metrics")

    # 4. Health Risk Index
    out("\n4. Health Risk Index (HRI):")
    hri = monitor.compute_health_risk_index(astronaut_id)
    if hri:
        out(f"   Score: {hri['risk_score']} / 100")
        out(f"   Severity: {hri['severity']}")
    else:
        out("   ERROR: HRI computation failed")

    # 5. Anomaly detection and explanations
    out("\n5. Anomaly detection (last 120 days to ensure anomalies):")
    anomaly_results = monitor.detect_anomalies(astronaut_id, days=120)
    if anomaly_results and 'anomaly_results' in anomaly_results:
        anomaly_flags = anomaly_results['anomaly_results']['is_anomaly_bool']
        count = anomaly_flags.sum()
        out(f"   Anomalies detected: {count} / {len(anomaly_flags)}")
        if count > 0:
            explanations = anomaly_results['anomaly_results'].get('explanations', [])
            out(f"   Explanations available: {len(explanations)}")
            if explanations:
                exp = explanations[0]
                out(f"   First explanation timestamp: {exp.get('timestamp')}")
                out(f"   Anomaly score: {exp.get('anomaly_score')}")
                contributors = exp.get('top_contributors', [])
                out(f"   Top contributors: {len(contributors)}")
                for c in contributors[:2]:
                    # Safely get the description, replace any problematic characters for console output
                    desc = c.get('description', 'N/A')
                    # Replace sigma symbol with the word 'sigma' to avoid encoding issues in console
                    desc = desc.replace('σ', 'sigma')
                    out(f"     - {desc}")
            else:
                out("   WARNING: No explanations despite anomalies")
        else:
            out("   INFO: No anomalies in the selected window")
    else:
        out("   ERROR: Anomaly detection failed")

    # 6. Alerts
    out("\n6. Alerts:")
    alerts = monitor.get_active_alerts(astronaut_id)
    out(f"   Active alerts count: {len(alerts)}")
    if alerts:
        for alert in alerts[:3]:
            out(f"   - {alert['name']} ({alert['severity']}): {alert['value']} {alert.get('metric', '')}_unit")
    else:
        out("   INFO: No active alerts")

    # 7. Longitudinal analysis
    out("\n7. Longitudinal analysis (heart_rate, 30 days):")
    analysis = monitor.get_longitudinal_analysis(astronaut_id, metric='heart_rate', days=30)
    if analysis:
        out(f"   Data points: {len(analysis['timestamps'])}")
        out(f"   Baseline mean: {analysis['baseline_mean']:.2f}")
        out(f"   Baseline std: {analysis['baseline_std']:.2f}")
        out(f"   Percent sustained change: {analysis['percent_sustained']}%")
    else:
        out("   ERROR: Longitudinal analysis failed")

    # 8. Data quality
    out("\n8. Data quality summary:")
    quality = monitor.get_data_quality_summary(astronaut_id)
    if quality:
        out(f"   Total records: {quality.get('total_records')}")
        out(f"   Quality distribution: {quality.get('quality_distribution')}")
        out(f"   Date range: {quality.get('date_range')}")
    else:
        out("   ERROR: Could not get data quality summary")

    out("\n=== Verification complete ===")
    # Now print all the output lines
    for line in output_lines:
        print(line)

if __name__ == '__main__':
    main()