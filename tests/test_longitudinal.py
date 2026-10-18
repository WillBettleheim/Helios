import pytest
import pandas as pd
import numpy as np
from monitoring.health_monitor import HealthMonitor
from utils.visualization import HealthVisualizer
from plotly.graph_objects import Figure

@pytest.fixture(scope="module")
def monitor():
    hm = HealthMonitor()
    hm.initialize()
    return hm

def test_longitudinal_analysis_invalid_input(monitor):
    # Invalid astronaut
    result = monitor.get_longitudinal_analysis(astronaut_id='NONEXISTENT', metric='heart_rate')
    assert result is None
    # Invalid metric
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    result = monitor.get_longitudinal_analysis(astronaut_id=astronaut_id, metric='invalid_metric')
    assert result is None

def test_longitudinal_analysis_structure(monitor):
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    # Use a metric that exists
    metric = 'heart_rate'
    result = monitor.get_longitudinal_analysis(astronaut_id=astronaut_id, metric=metric, days=30)
    assert result is not None
    # Check expected keys
    expected_keys = {'timestamps', 'values', 'baseline_mean', 'baseline_std', 'rolling_mean', 'sustained_change', 'percent_sustained'}
    assert set(result.keys()) == expected_keys
    # Check types
    assert isinstance(result['timestamps'], pd.Series)
    assert isinstance(result['values'], pd.Series)
    assert isinstance(result['rolling_mean'], pd.Series)
    assert isinstance(result['sustained_change'], pd.Series)
    assert isinstance(result['percent_sustained'], float)
    # Check that the series have the same length
    assert len(result['timestamps']) == len(result['values']) == len(result['rolling_mean']) == len(result['sustained_change'])
    # Check that percent_sustained is between 0 and 100
    assert 0 <= result['percent_sustained'] <= 100

def test_longitudinal_visualization_returns_figure(monitor):
    visualizer = HealthVisualizer()
    astronaut_id = monitor.get_astronaut_list()[0]['astronaut_id']
    metric = 'heart_rate'
    analysis = monitor.get_longitudinal_analysis(astronaut_id=astronaut_id, metric=metric, days=30)
    assert analysis is not None
    fig = visualizer.create_longitudinal_trend(analysis, metric)
    assert fig is not None
    # Check that it's a Plotly Figure object (has data and layout attributes)
    assert isinstance(fig, Figure)