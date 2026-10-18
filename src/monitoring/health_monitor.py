"""
Health Monitoring System for HELIOS
Main monitoring logic that coordinates data loading, anomaly detection, and alerts
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.utils.data_loader import DataLoader
from ml.anomaly_detector import HealthAnomalyDetector
from utils.alerts import AlertManager
from utils.visualization import HealthVisualizer

class HealthMonitor:
    def __init__(self, data_path="data/health_data.csv",
                 profiles_path="data/health_data_profiles.json",
                 model_path="models/anomaly_detector.pkl"):
        self.data_loader = DataLoader(data_path, profiles_path)
        self.anomaly_detector = None
        self.alert_manager = AlertManager()
        self.visualizer = HealthVisualizer()
        self.model_path = model_path
        self.current_astronaut = None
        self.model_loaded = False

    def initialize(self):
        """Initialize the monitoring system"""
        # Load data
        self.data_loader.load_data()

        # Load pre-trained model
        if os.path.exists(self.model_path):
            self.anomaly_detector = HealthAnomalyDetector()
            self.anomaly_detector.load_model(self.model_path)
            self.model_loaded = True
            print("Model loaded successfully")
        else:
            print("Model not found. Please train the model first.")

    def load_model(self):
        """Load the anomaly detection model"""
        if not self.model_loaded and os.path.exists(self.model_path):
            self.anomaly_detector = HealthAnomalyDetector()
            self.anomaly_detector.load_model(self.model_path)
            self.model_loaded = True
            print("Model loaded successfully")

    def set_astronaut(self, astronaut_id):
        """Set the current astronaut for monitoring"""
        # Check if astronaut exists
        astronauts = self.data_loader.get_astronauts()
        if any(a['astronaut_id'] == astronaut_id for a in astronauts):
            self.current_astronaut = astronaut_id
            return True
        return False

    def get_astronaut_list(self):
        """Get list of available astronauts"""
        return self.data_loader.get_astronauts()

    def get_astronaut_profile(self, astronaut_id=None):
        """Get profile for current or specified astronaut"""
        if astronaut_id is None:
            astronaut_id = self.current_astronaut

        if astronaut_id:
            return self.data_loader.get_astronaut_profile(astronaut_id)
        return None

    def get_latest_metrics(self, astronaut_id=None, n_records=10):
        """Get latest health metrics for astronaut"""
        if astronaut_id is None:
            astronaut_id = self.current_astronaut

        if astronaut_id:
            return self.data_loader.get_latest_data(astronaut_id, n_records)
        return None

    def get_time_range_data(self, astronaut_id=None, start_date=None, end_date=None, days=None):
        """Get data for a specific time range"""
        if astronaut_id is None:
            astronaut_id = self.current_astronaut

        if astronaut_id:
            return self.data_loader.get_time_range_data(astronaut_id, start_date, end_date, days)
        return None

    def detect_anomalies(self, astronaut_id=None, days=7):
        """Detect anomalies in recent data"""
        if astronaut_id is None:
            astronaut_id = self.current_astronaut

        if not astronaut_id or not self.model_loaded:
            return None

        # Get recent data
        data = self.get_time_range_data(astronaut_id, days=days)

        if data is None or data.empty:
            return None

        # Detect anomalies
        anomaly_results = self.anomaly_detector.predict(data)

        # Get baseline metrics
        profile = self.get_astronaut_profile(astronaut_id)
        baseline_metrics = profile['baseline_metrics'] if profile else {}

        # Generate alerts
        alerts = self.alert_manager.generate_alerts(
            data, anomaly_results, baseline_metrics, astronaut_id
        )

        return {
            'data': data,
            'anomaly_results': anomaly_results,
            'alerts': alerts,
            'baseline_metrics': baseline_metrics
        }

    def get_active_alerts(self, astronaut_id=None):
        """Get active alerts for astronaut"""
        if astronaut_id is None:
            astronaut_id = self.current_astronaut

        if astronaut_id:
            return self.alert_manager.get_active_alerts(astronaut_id)
        return []

    def acknowledge_alert(self, alert_id):
        """Acknowledge an alert"""
        self.alert_manager.acknowledge_alert(alert_id)

    def get_alert_statistics(self, astronaut_id=None, days=30):
        """Get alert statistics"""
        if astronaut_id is None:
            astronaut_id = self.current_astronaut

        if astronaut_id:
            return self.alert_manager.get_alert_statistics(days)
        return {}

    def get_data_quality_summary(self, astronaut_id=None):
        """Get data quality summary"""
        if astronaut_id is None:
            astronaut_id = self.current_astronaut

        if astronaut_id:
            return self.data_loader.get_data_quality_summary(astronaut_id)
        return None

    def create_metric_timeline(self, metric, days=7):
        """Create timeline visualization for a metric"""
        if not self.current_astronaut:
            return None

        # Pass astronaut_id explicitly to fetch data for the selected astronaut
        data = self.get_time_range_data(self.current_astronaut, days=days)
        if data is None or data.empty:
            return None

        return self.visualizer.create_metric_timeline(data, metric)

    def create_multi_metric_dashboard(self, metrics=None, days=7):
        """Create multi-metric dashboard"""
        if not self.current_astronaut:
            return None

        if metrics is None:
            metrics = [
                'heart_rate', 'blood_oxygen', 'systolic_bp',
                'diastolic_bp', 'sleep_duration', 'stress_level'
            ]

        data = self.get_time_range_data(days=days)
        if data is None or data.empty:
            return None

        return self.visualizer.create_multi_metric_dashboard(data, metrics, days)

    def create_anomaly_scatter(self, metric, days=7):
        """Create anomaly scatter plot"""
        if not self.current_astronaut:
            return None

        anomaly_results = self.detect_anomalies(days=days)
        if anomaly_results is None:
            return None

        data = anomaly_results['data']
        return self.visualizer.create_anomaly_scatter(data, anomaly_results['anomaly_results'], metric)

    def get_model_info(self):
        """Get information about the loaded model"""
        if self.model_loaded and self.anomaly_detector:
            return {
                'model_loaded': True,
                'is_trained': self.anomaly_detector.is_trained,
                'contamination': self.anomaly_detector.contamination,
                'training_stats': self.anomaly_detector.training_stats,
                'feature_names': self.anomaly_detector.feature_names
            }
        return {'model_loaded': False}

    def get_longitudinal_analysis(self, astronaut_id=None, metric=None, days=30, window_size=3, threshold_sigma=1.0):
        """
        Perform longitudinal analysis of a health metric against astronaut-specific baseline.
        Returns a dict containing:
          - 'timestamps': series of timestamps
          - 'values': series of metric values
          - 'baseline_mean': baseline mean for the metric
          - 'baseline_std': baseline std for the metric
          - 'rolling_mean': rolling average of the metric (window_size points)
          - 'sustained_change': boolean series indicating where rolling mean deviates
                                from baseline by more than threshold_sigma * baseline_std
                                for at least window_size consecutive points (simplified: any point exceeding threshold)
          - 'percent_sustained': percentage of points flagged as sustained change
        This method does NOT apply clinical thresholds; it uses statistical deviations.
        """
        if astronaut_id is None:
            astronaut_id = self.current_astronaut
        if not astronaut_id or not metric:
            return None
        # Get data for the requested period
        try:
            data = self.get_time_range_data(astronaut_id, days=days)
        except Exception:
            # If astronaut does not exist or data cannot be retrieved, return None
            return None
        if data is None or data.empty or metric not in data.columns:
            return None
        # Ensure timestamp sorted
        data = data.sort_values('timestamp')
        timestamps = data['timestamp']
        values = data[metric].astype(float)
        # Get baseline
        profile = self.get_astronaut_profile(astronaut_id)
        baseline = profile.get('baseline_metrics', {})
        if not baseline or metric not in baseline:
            return None
        baseline_mean = baseline[metric]['mean']
        baseline_std = baseline[metric]['std']
        if baseline_std is None or baseline_std == 0:
            # avoid division by zero
            baseline_std = 1e-6
        # Compute rolling mean (using window_size of consecutive points)
        rolling_mean = values.rolling(window=window_size, min_periods=1).mean()
        # Determine deviation in sigma units
        deviation = np.abs(rolling_mean - baseline_mean) / baseline_std
        # Identify points where deviation exceeds threshold
        sustained = deviation > threshold_sigma
        # For simplicity, we consider any point exceeding threshold as sustained change.
        # A more sophisticated version would require consecutive points, but we keep it simple.
        percent_sustained = (sustained.sum() / len(sustained)) * 100.0 if len(sustained) > 0 else 0.0
        return {
            'timestamps': timestamps,
            'values': values,
            'baseline_mean': baseline_mean,
            'baseline_std': baseline_std,
            'rolling_mean': rolling_mean,
            'sustained_change': sustained,
            'percent_sustained': round(percent_sustained, 2)
        }


    def compute_health_risk_index(self, astronaut_id=None, days=7):
        """
        Compute a simple, interpretable Health Risk Index (0‑100) for the astronaut.
        It is based on standardized deviations from the astronaut‑specific baseline
        metrics and incorporates the Isolation Forest anomaly score (scaled to 20 points).
        No clinical weighting is applied – each metric contributes equally.
        Returns a dict with keys:
            'risk_score' (float, 0‑100)
            'severity'   ('low', 'moderate', 'high')
        Returns None if data is unavailable.
        """
        if astronaut_id is None:
            astronaut_id = self.current_astronaut
        if not astronaut_id:
            return None

        # Recent data (default 7 days)
        try:
            data = self.get_time_range_data(astronaut_id, days=days)
        except Exception:
            # If astronaut does not exist or data cannot be retrieved, return None
            return None
        if data is None or data.empty:
            return None


        profile = self.get_astronaut_profile(astronaut_id)
        baseline = profile.get('baseline_metrics', {})
        if not baseline:
            return None

        # Compute absolute z‑score for each metric present in baseline
        z_scores = []
        for metric, stats in baseline.items():
            if metric in data.columns:
                mean = stats.get('mean')
                std = stats.get('std')
                if std and std > 0:
                    # Use the most recent record for simplicity
                    value = data.iloc[0][metric]
                    z = abs(value - mean) / std
                    z_scores.append(z)
        if not z_scores:
            return None

        # Average z‑score, cap at 5σ for robustness, map to 0‑80 points
        avg_z = sum(z_scores) / len(z_scores)
        avg_z_capped = min(avg_z, 5.0)
        metric_score = (avg_z_capped / 5.0) * 80  # max 80 points from metrics

        # Anomaly detection contribution (0‑20 points)
        anomaly_score = 0
        if self.model_loaded:
            anomaly_info = self.detect_anomalies(astronaut_id, days=days)
            if anomaly_info and anomaly_info.get('anomaly_results'):
                scores = anomaly_info['anomaly_results'].get('anomaly_scores')
                if scores is not None and scores.size:
                    # IsolationForest decision_function: more negative = more anomalous
                    # Normalize to 0‑1 using min (most negative) and max (least negative)
                    min_score, max_score = scores.min(), scores.max()
                    if min_score != max_score:
                        norm = (abs(min_score) / (abs(min_score) + max_score))
                        anomaly_score = norm * 20  # max 20 points
        # Composite risk index
        risk_score = round(metric_score + anomaly_score, 1)
        # Simple severity buckets
        if risk_score < 33:
            severity = 'low'
        elif risk_score < 66:
            severity = 'moderate'
        else:
            severity = 'high'
        return {'risk_score': risk_score, 'severity': severity}

    def get_mission_status(self, astronaut_id=None):
        """Get overall mission health status"""
        if astronaut_id is None:
            astronaut_id = self.current_astronaut

        if not astronaut_id:
            return None

        # Get data quality
        quality_summary = self.get_data_quality_summary(astronaut_id)

        # Get active alerts
        active_alerts = self.get_active_alerts(astronaut_id)

        # Get latest metrics
        latest_metrics = self.get_latest_metrics(astronaut_id, 5)

        # Determine overall status
        critical_alerts = [a for a in active_alerts if a['severity'] == 'critical']
        high_alerts = [a for a in active_alerts if a['severity'] == 'high']

        if critical_alerts:
            status = 'critical'
            status_color = 'red'
        elif high_alerts:
            status = 'high_priority'
            status_color = 'orange'
        elif active_alerts:
            status = 'monitoring'
            status_color = 'yellow'
        else:
            status = 'normal'
            status_color = 'green'

        return {
            'astronaut_id': astronaut_id,
            'status': status,
            'status_color': status_color,
            'active_alerts': len(active_alerts),
            'critical_alerts': len(critical_alerts),
            'data_quality': quality_summary,
            'latest_metrics': latest_metrics.to_dict('records') if latest_metrics is not None else []
        }