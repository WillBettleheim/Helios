"""Tests for the DataLoader utility"""

import pytest
import pandas as pd
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.utils.data_loader import DataLoader

@pytest.fixture(scope="module")
def loader():
    return DataLoader(data_path="data/health_data.csv", profiles_path="data/health_data_profiles.json")

def test_load_data(loader):
    data, profiles = loader.load_data()
    # Basic sanity checks
    assert isinstance(data, pd.DataFrame)
    assert not data.empty
    assert 'timestamp' in data.columns
    assert isinstance(profiles, list)
    assert len(profiles) >= 1

def test_get_astronauts(loader):
    astronauts = loader.get_astronauts()
    assert isinstance(astronauts, list)
    assert len(astronauts) >= 1
    # Check required keys
    for a in astronauts:
        assert 'astronaut_id' in a
        assert 'baseline_metrics' in a

def test_astronaut_specific_data(loader):
    astronauts = loader.get_astronauts()
    first_id = astronauts[0]['astronaut_id']
    df = loader.get_astronaut_data(first_id)
    assert not df.empty
    assert (df['astronaut_id'] == first_id).all()

def test_time_range(loader):
    astronauts = loader.get_astronauts()
    first_id = astronauts[0]['astronaut_id']
    # Get last 7 days of data
    recent = loader.get_time_range_data(first_id, days=7)
    assert not recent.empty
    # Ensure timestamps are within 7 days from max
    max_ts = recent['timestamp'].max()
    min_allowed = max_ts - pd.Timedelta(days=7)
    assert recent['timestamp'].min() >= min_allowed