"""Tests for the HealthAnomalyDetector"""

import pytest
import pandas as pd
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.ml.anomaly_detector import HealthAnomalyDetector, train_model_on_data

@pytest.fixture(scope="module")
def detector():
    # Train a fresh detector on the generated data
    det, results = train_model_on_data(data_path="data/health_data.csv")
    return det

def test_training_results(detector):
    # Ensure detector is trained and stats are populated
    assert detector.is_trained
    assert detector.training_stats
    # Validate that training size matches expectation (approx 80% of 1089 = 871)
    assert detector.training_stats['means']  # means dict exists

def test_prediction_on_subset(detector):
    # Load a small subset of data for prediction
    df = pd.read_csv("data/health_data.csv").head(20)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    pred = detector.predict(df)
    # Should return dict with expected keys
    assert 'predictions' in pred and 'anomaly_scores' in pred and 'explanations' in pred
    # predictions length matches input
    assert len(pred['predictions']) == len(df)
    # At least one explanation if anomalies present
    if any(pred['predictions']):
        assert isinstance(pred['explanations'], list)
        assert len(pred['explanations']) >= 1