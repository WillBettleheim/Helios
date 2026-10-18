import pytest
from monitoring.health_monitor import HealthMonitor
import pandas as pd

@pytest.fixture(scope="module")
def monitor():
    hm = HealthMonitor()
    hm.initialize()
    return hm

def test_hri_normal(monitor):
    # Choose astronaut with minimal alerts (e.g., first astronaut)
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    hri = monitor.compute_health_risk_index(astronaut_id)
    assert hri is not None
    assert 0 <= hri['risk_score'] <= 100
    assert hri['severity'] in {'low', 'moderate', 'high'}

def test_hri_invalid_astronaut(monitor):
    # Non‑existent astronaut should return None
    assert monitor.compute_health_risk_index('NON_EXISTENT') is None

def test_hri_missing_data(monkeypatch, monitor):
    # Patch get_time_range_data to return empty DataFrame
    def empty_data(*args, **kwargs):
        return pd.DataFrame()
    monkeypatch.setattr(monitor, 'get_time_range_data', empty_data)
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    assert monitor.compute_health_risk_index(astronaut_id) is None
