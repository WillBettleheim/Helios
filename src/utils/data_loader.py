"""
Data loading utilities for HELIOS
Handles loading and preprocessing of health data
"""

import pandas as pd
import json
import numpy as np
from datetime import datetime, timedelta
import os

class DataLoader:
    def __init__(self, data_path="data/health_data.csv", profiles_path="data/health_data_profiles.json"):
        self.data_path = data_path
        self.profiles_path = profiles_path
        self.data = None
        self.profiles = None
        self.current_astronaut = None

    def load_data(self):
        """Load health data and astronaut profiles"""
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Data file not found: {self.data_path}")

        # Load health data
        self.data = pd.read_csv(self.data_path)
        # Ensure module is available via both import paths
        import sys
        sys.modules.setdefault('src.utils.data_loader', sys.modules[__name__])
        self.data['timestamp'] = pd.to_datetime(self.data['timestamp'])

        # Load astronaut profiles
        if os.path.exists(self.profiles_path):
            with open(self.profiles_path, 'r') as f:
                self.profiles = json.load(f)

        return self.data, self.profiles

    def get_astronauts(self):
        """Get list of available astronauts"""
        if self.profiles is None:
            self.load_data()

        return self.profiles

    def get_astronaut_data(self, astronaut_id):
        """Get data for specific astronaut"""
        if self.data is None:
            self.load_data()

        astronaut_data = self.data[self.data['astronaut_id'] == astronaut_id].copy()

        if len(astronaut_data) == 0:
            raise ValueError(f"No data found for astronaut {astronaut_id}")

        return astronaut_data

    def get_time_range_data(self, astronaut_id, start_date=None, end_date=None, days=None):
        """Get data for a specific time range"""
        data = self.get_astronaut_data(astronaut_id)

        # Convert to datetime if not already
        if start_date and isinstance(start_date, str):
            start_date = pd.to_datetime(start_date)
        if end_date and isinstance(end_date, str):
            end_date = pd.to_datetime(end_date)

        # Apply time filters
        if start_date:
            data = data[data['timestamp'] >= start_date]
        if end_date:
            data = data[data['timestamp'] <= end_date]
        if days:
            cutoff_date = data['timestamp'].max() - timedelta(days=days)
            data = data[data['timestamp'] >= cutoff_date]
        # Always exclude future timestamps to maintain a consistent mission timeline
        now = pd.Timestamp.now()
        data = data[data['timestamp'] <= now]

        return data

    def get_latest_data(self, astronaut_id, n_records=10):
        """Get the most recent records for an astronaut"""
        data = self.get_astronaut_data(astronaut_id)
        return data.sort_values('timestamp', ascending=False).head(n_records)

    def get_astronaut_profile(self, astronaut_id):
        """Get astronaut profile information"""
        if self.profiles is None:
            self.load_data()

        for profile in self.profiles:
            if profile['astronaut_id'] == astronaut_id:
                return profile

        raise ValueError(f"Profile not found for astronaut {astronaut_id}")

    def get_baseline_metrics(self, astronaut_id):
        """Get baseline metrics for an astronaut"""
        profile = self.get_astronaut_profile(astronaut_id)
        return profile['baseline_metrics']

    def get_feature_columns(self):
        """Get list of health metric columns"""
        if self.data is None:
            self.load_data()

        # Health metric columns (excluding metadata)
        feature_cols = [
            'heart_rate', 'blood_oxygen', 'systolic_bp', 'diastolic_bp',
            'body_temp', 'sleep_duration', 'sleep_quality',
            'physical_activity', 'stress_level', 'mood_score'
        ]

        return feature_cols

    def get_data_quality_summary(self, astronaut_id):
        """Get summary of data quality for an astronaut"""
        data = self.get_astronaut_data(astronaut_id)

        quality_counts = data['data_quality'].value_counts()
        source_counts = data['data_source'].value_counts()

        return {
            'total_records': len(data),
            'quality_distribution': quality_counts.to_dict(),
            'source_distribution': source_counts.to_dict(),
            'date_range': {
                'start': data['timestamp'].min().isoformat(),
                'end': data['timestamp'].max().isoformat()
            }
        }