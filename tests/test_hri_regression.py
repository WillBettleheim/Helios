import pytest
import pandas as pd
from monitoring.health_monitor import HealthMonitor
from datetime import datetime, timedelta

@pytest.fixture(scope='module')
def monitor():
    hm = HealthMonitor()
    hm.initialize()
    return hm

def test_anomaly_explanations_have_contributors(monitor):
    # Pick an astronaut where we know anomalies exist (use first)
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    # Run detection on a long window to ensure anomalies present
    results = monitor.detect_anomalies(astronaut_id, days=120)
    assert results is not None
    explanations = results['anomaly_results'].get('explanations', [])
    # At least one explanation should have top_contributors
    assert any(exp.get('top_contributors') for exp in explanations), "No contributors found in explanations"

def test_get_time_range_data_filters_future(monkeypatch, monitor):
    # Create a DataFrame with a future timestamp
    now = pd.Timestamp.now()
    future = now + pd.Timedelta(days=10)
    df = pd.DataFrame({
        'timestamp': [future],
        'astronaut_id': ['ASTR001'],
        'heart_rate': [70],
        'blood_oxygen': [99],
        'systolic_bp': [120],
        'diastolic_bp': [80],
        'body_temp': [98.6],
        'sleep_duration': [8],
        'sleep_quality': [8],
        'physical_activity': [5],
        'stress_level': [4],
        'mood_score': [9]
    })
    # Patch DataLoader to return this df for get_astronaut_data
    def fake_get_astronaut_data(self, astronaut_id):
        return df.copy()
    monkeypatch.setattr('src.utils.data_loader.DataLoader.get_astronaut_data', fake_get_astronaut_data)
    # Now call get_time_range_data
    data = monitor.get_time_range_data('ASTR001', days=None)
    # Should be empty because future filtered out
    assert data.empty, "Future timestamps were not filtered out"

def test_hri_score_bounds(monitor):
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    hri = monitor.compute_health_risk_index(astronaut_id)
    assert hri is not None
    assert 0 <= hri['risk_score'] <= 100
    assert hri['severity'] in {'low', 'moderate', 'high'}
