import pytest
from src.monitoring.health_monitor import HealthMonitor
from src.utils.visualization import HealthVisualizer
import plotly.graph_objects as go

@pytest.fixture(scope="module")
def mononitor():
    hm = HealthMonitor()
    hm.initialize()
    astronauts = hm.get_astronaut_list()
    assert astronauts, "No astronauts loaded"
    astronaut_id = astronauts[0]['astronaut_id']
    hm.set_astronaut(astronaut_id)
    return hm, astronaut_id

def test_anomaly_explanations_timestamp(mononitor):
    hm, astronaut_id = mononitor
    # Use enough days to ensure anomalies exist
    results = hm.detect_anomalies(astronaut_id, days=120)
    assert results is not None
    explanations = results['anomaly_results'].get('explanations', [])
    assert explanations, "No explanations found"
    # Verify each timestamp is a datetime object and supports strftime
    for exp in explanations:
        ts = exp['timestamp']
        assert hasattr(ts, 'strftime'), "Timestamp is not datetime"
        # Simple format test
        formatted = ts.strftime('%Y-%m-%d %H:%M')
        assert isinstance(formatted, str)

def test_metric_timeline_key(mononitor):
    hm, astronaut_id = mononitor
    # Create timeline for a known metric
    metric_key = 'heart_rate'
    fig = hm.create_metric_timeline(metric_key, days=7)
    assert fig is not None, "Timeline figure should be created"
    # Ensure figure has data for the metric
    data = fig.data[0]
    assert data.y is not None
    # Verify metric name appears in title
    assert metric_key.replace('_', ' ').title() in fig.layout.title.text

def test_create_anomaly_scatter_method_exists():
    """Test that HealthVisualizer has the create_anomaly_scatter method."""
    viz = HealthVisualizer()
    assert hasattr(viz, 'create_anomaly_scatter'), "HealthVisualizer missing create_anomaly_scatter method"
    assert callable(getattr(viz, 'create_anomaly_scatter')), "create_anomaly_scatter is not callable"

def test_create_anomaly_scatter_returns_figure():
    """Test that create_anomaly_scatter returns a Plotly figure when given valid data."""
    viz = HealthVisualizer()
    # Create minimal test data
    import pandas as pd
    import numpy as np
    from datetime import datetime, timedelta

    timestamps = [datetime.now() - timedelta(days=i) for i in range(10)]
    data = pd.DataFrame({
        'timestamp': timestamps,
        'heart_rate': np.random.normal(70, 10, 10),
        'body_temp': np.random.normal(98.6, 1, 10)
    })
    anomaly_results = {
        'is_anomaly_bool': [False, False, True, False, False, False, True, False, False, False]
    }

    fig = viz.create_anomaly_scatter(data, anomaly_results, 'heart_rate')
    assert isinstance(fig, go.Figure), "create_anomaly_scatter should return a Plotly Figure"
    # Check that we have two traces (normal and anomalous)
    assert len(fig.data) == 2, "Expected two traces (normal and anomalous)"
    # Check that the traces have the correct names
    trace_names = [trace.name for trace in fig.data]
    assert 'Normal' in trace_names
    assert 'Anomaly' in trace_names

def test_body_temperature_column_mapping(mononitor):
    """Test that Body Temperature maps to the correct column 'body_temp' without KeyError."""
    hm, astronaut_id = mononitor
    # Create timeline for body_temp (the correct column name)
    fig = hm.create_metric_timeline('body_temp', days=7)
    assert fig is not None, "Timeline for body_temp should be created"
    # Ensure figure has data for the metric
    data = fig.data[0]
    assert data.y is not None, "body_temp timeline should have data"
    # Verify metric name appears in title
    assert 'Body Temp' in fig.layout.title.text or 'body_temp' in fig.layout.title.text
