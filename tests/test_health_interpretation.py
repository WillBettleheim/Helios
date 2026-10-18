import pytest
import pandas as pd
from monitoring.health_monitor import HealthMonitor
from utils.data_loader import DataLoader
from datetime import datetime, timedelta

@pytest.fixture(scope="module")
def monitor():
    hm = HealthMonitor()
    hm.initialize()
    return hm

def test_no_future_timestamps_in_data(monitor):
    """Ensure that get_time_range_data never returns timestamps in the future."""
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    # Test with various day ranges
    for days in [1, 7, 30, None]:
        data = monitor.get_time_range_data(astronaut_id, days=days)
        if data is not None and not data.empty:
            now = pd.Timestamp.now()
            assert (data['timestamp'] <= now).all(), \
                f"Found future timestamps in data for days={days}"

def test_mission_status_depends_only_on_alerts(monitor):
    """Mission status should be derived solely from active alerts, not from anomaly count or HRI."""
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    # Get current mission status
    status = monitor.get_mission_status(astronaut_id)
    assert status is not None
    # Get active alerts
    alerts = monitor.get_active_alerts(astronaut_id)
    # Determine expected status based on alert severity
    critical_alerts = [a for a in alerts if a['severity'] == 'critical']
    high_alerts = [a for a in alerts if a['severity'] == 'high']
    if critical_alerts:
        expected_status = 'critical'
    elif high_alerts:
        expected_status = 'high_priority'
    elif alerts:
        expected_status = 'monitoring'
    else:
        expected_status = 'normal'
    assert status['status'] == expected_status, \
        f"Mission status {status['status']} does not match alert-based expectation {expected_status}"

def test_hri_severity_labels_match_score(monitor):
    """HRI severity labels should correspond to the defined score thresholds."""
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    hri = monitor.compute_health_risk_index(astronaut_id)
    assert hri is not None
    score = hri['risk_score']
    severity = hri['severity']
    if score < 33:
        expected = 'low'
    elif score < 66:
        expected = 'moderate'
    else:
        expected = 'high'
    assert severity == expected, \
        f"HRI severity '{severity}' does not match score {score} (expected '{expected}')"

def test_anomalies_do_not_trigger_alerts_without_threshold_violation(monitor):
    """Anomaly detection results should not automatically generate alerts unless they violate a rule."""
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    # Get anomaly detection results for a window likely to contain anomalies
    results = monitor.detect_anomalies(astronaut_id, days=30)
    assert results is not None
    anomaly_count = results['anomaly_results']['is_anomaly_bool'].sum()
    # If there are anomalies, check that alerts are only those that also meet rule conditions
    alerts = monitor.get_active_alerts(astronaut_id)
    # We cannot assert that alert count equals anomaly count, because alerts depend on thresholds.
    # Instead, we verify that each alert's metric value violates its rule condition.
    for alert in alerts:
        metric = alert['metric']
        value = alert['value']
        # Retrieve the rule for this metric from AlertManager
        # We'll instantiate an AlertManager to access the rules
        from utils.alerts import AlertManager
        am = AlertManager()
        rule = am.alert_rules.get(metric)
        assert rule is not None, f"No rule found for metric {metric}"
        # The condition should be true for the alert to be generated
        assert rule['condition'](value), \
            f"Alert for {metric} with value {value} does not satisfy rule condition"