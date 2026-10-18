"""
Alert generation and management for HELIOS
Creates appropriate health alerts based on anomaly detection and predefined rules
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional

class AlertManager:
    def __init__(self):
        self.alert_history = []
        self.acknowledged_alerts = set()
        self.alert_rules = self._define_alert_rules()

    def _define_alert_rules(self):
        """Define alert rules with severity levels and thresholds"""
        return {
            # Critical alerts (require immediate attention)
            'critical_heart_rate': {
                'name': 'Critical Heart Rate',
                'severity': 'critical',
                'condition': lambda x: x > 150 or x < 40,
                'message': 'Critical heart rate detected. Seek medical attention immediately.',
                'action': 'Contact mission medical officer immediately.'
            },
            'critical_blood_oxygen': {
                'name': 'Critical Blood Oxygen',
                'severity': 'critical',
                'condition': lambda x: x < 85,
                'message': 'Low blood oxygen detected. May indicate respiratory distress.',
                'action': 'Use supplemental oxygen if available. Contact medical support.'
            },
            'critical_blood_pressure': {
                'name': 'Critical Blood Pressure',
                'severity': 'critical',
                'condition': lambda x: x > 180 or x < 80,
                'message': 'Critical blood pressure detected. Hypertensive emergency or hypotension.',
                'action': 'Contact mission medical officer immediately.'
            },
            'critical_temperature': {
                'name': 'Critical Body Temperature',
                'severity': 'critical',
                'condition': lambda x: x > 104 or x < 95,
                'message': 'Critical body temperature detected. Hypothermia or hyperthermia.',
                'action': 'Seek medical attention immediately. Implement temperature regulation.'
            },

            # High priority alerts
            'high_stress': {
                'name': 'High Stress Level',
                'severity': 'high',
                'condition': lambda x: x >= 8,
                'message': 'Elevated stress levels detected.',
                'action': 'Consider stress management techniques. Discuss with mission psychologist.'
            },
            'low_mood': {
                'name': 'Low Mood Score',
                'severity': 'high',
                'condition': lambda x: x <= 3,
                'message': 'Low mood score detected. Possible depression or adjustment issues.',
                'action': 'Consider speaking with mission psychologist. Monitor for worsening symptoms.'
            },
            'severe_sleep_deprivation': {
                'name': 'Severe Sleep Deprivation',
                'severity': 'high',
                'condition': lambda x: x < 4,
                'message': 'Severely insufficient sleep duration.',
                'action': 'Adjust schedule to ensure adequate rest. Consult with mission team.'
            },

            # Medium priority alerts
            'moderate_sleep_issue': {
                'name': 'Moderate Sleep Issue',
                'severity': 'medium',
                'condition': lambda x: x < 5,
                'message': 'Reduced sleep duration detected.',
                'action': 'Monitor sleep patterns. Consider adjusting pre-sleep routine.'
            },
            'elevated_stress': {
                'name': 'Elevated Stress Level',
                'severity': 'medium',
                'condition': lambda x: x >= 7,
                'message': 'Elevated stress levels detected.',
                'action': 'Practice stress management techniques. Monitor for persistent elevation.'
            },
            'poor_sleep_quality': {
                'name': 'Poor Sleep Quality',
                'severity': 'medium',
                'condition': lambda x: x < 5,
                'message': 'Poor sleep quality detected.',
                'action': 'Evaluate sleep environment. Consider relaxation techniques.'
            },

            # Low priority alerts
            'mild_sleep_deprivation': {
                'name': 'Mild Sleep Deprivation',
                'severity': 'low',
                'condition': lambda x: x < 6.5,
                'message': 'Mild reduction in sleep duration.',
                'action': 'Monitor sleep patterns. Maintain good sleep hygiene.'
            },
            'slightly_elevated_stress': {
                'name': 'Slightly Elevated Stress',
                'severity': 'low',
                'condition': lambda x: x >= 6,
                'message': 'Slightly elevated stress levels.',
                'action': 'Practice relaxation techniques. Monitor for changes.'
            }
        }

    def generate_alerts(self, data: pd.DataFrame, anomaly_results: Dict,
                       baseline_metrics: Dict, astronaut_id: str = None) -> List[Dict]:
        """
        Generate alerts based on data and anomaly detection results

        Args:
            data: Health data records
            anomaly_results: Results from anomaly detection
            baseline_metrics: Baseline metrics for the astronaut
            astronaut_id: ID of the astronaut

        Returns:
            List of alert dictionaries
        """
        alerts = []

        # Get indices of anomalous records
        anomaly_indices = anomaly_results.get('is_anomaly_bool', np.zeros(len(data), dtype=bool))

        for idx in range(len(data)):
            if not anomaly_indices[idx]:
                continue

            record = data.iloc[idx]
            record_time = record['timestamp']

            # Check each metric against alert rules
            for metric, rule in self.alert_rules.items():
                if metric in record:
                    value = record[metric]

                    # Check if condition is met
                    if rule['condition'](value):
                        alert = {
                            'alert_id': f"{metric}_{int(record_time.timestamp())}_{idx}",
                            'timestamp': record_time,
                            'metric': metric,
                            'value': value,
                            'severity': rule['severity'],
                            'name': rule['name'],
                            'message': rule['message'],
                            'recommended_action': rule['action'],
                            'anomaly_explanation': self._get_anomaly_explanation(
                                metric, value, baseline_metrics
                            ),
                            'data_quality': record.get('data_quality', 'unknown'),
                            'data_source': record.get('data_source', 'unknown'),
                            'astronaut_id': astronaut_id
                        }
                        alerts.append(alert)

        # Remove duplicate alerts (same metric within 24 hours)
        alerts = self._deduplicate_alerts(alerts)

        # Add to history
        self.alert_history.extend(alerts)

        return alerts

    def _get_anomaly_explanation(self, metric: str, value: float, baseline_metrics: Dict) -> str:
        """Generate explanation for why a value is flagged"""
        if metric not in baseline_metrics:
            return f"Baseline not available for {metric}"

        baseline = baseline_metrics[metric]['mean']
        baseline_std = baseline_metrics[metric]['std']

        if baseline_std > 0:
            deviation = abs(value - baseline) / baseline_std
            direction = "above" if value > baseline else "below"

            if deviation < 1.0:
                severity = "slightly"
            elif deviation < 1.5:
                severity = "moderately"
            elif deviation < 2.0:
                severity = "significantly"
            else:
                severity = "extremely"

            return f"{metric} is {severity} {direction} baseline by {deviation:.1f} standard deviations"

        return f"{metric} is {value:.1f} (baseline not fully available)"

    def _deduplicate_alerts(self, alerts: List[Dict]) -> List[Dict]:
        """Remove duplicate alerts for the same metric within 24 hours"""
        if not alerts:
            return alerts

        # Sort by timestamp
        alerts_sorted = sorted(alerts, key=lambda x: x['timestamp'], reverse=True)
        unique_alerts = []

        for alert in alerts_sorted:
            # Check if similar alert exists within 24 hours
            is_duplicate = False
            for existing in unique_alerts:
                if (existing['metric'] == alert['metric'] and
                    (existing['timestamp'] - alert['timestamp']).total_seconds() < 24 * 3600):
                    is_duplicate = True
                    break

            if not is_duplicate:
                unique_alerts.append(alert)

        return unique_alerts

    def acknowledge_alert(self, alert_id: str):
        """Acknowledge an alert"""
        self.acknowledged_alerts.add(alert_id)

    def get_active_alerts(self, astronaut_id: str = None) -> List[Dict]:
        """Get active (unacknowledged) alerts"""
        active = []
        for alert in self.alert_history:
            if alert['alert_id'] not in self.acknowledged_alerts:
                if astronaut_id is None or alert.get('astronaut_id') == astronaut_id:
                    active.append(alert)

        # Sort by severity and timestamp
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        active.sort(key=lambda x: (severity_order.get(x['severity'], 4), x['timestamp']), reverse=True)

        return active

    def get_alert_history(self, days: int = 30) -> List[Dict]:
        """Get alert history for specified number of days"""
        cutoff_date = datetime.now() - timedelta(days=days)

        recent_alerts = []
        for alert in self.alert_history:
            if alert['timestamp'] >= cutoff_date:
                recent_alerts.append(alert)

        return recent_alerts

    def get_alert_statistics(self, days: int = 30) -> Dict:
        """Get alert statistics for specified period"""
        alerts = self.get_alert_history(days)

        if not alerts:
            return {
                'total_alerts': 0,
                'by_severity': {},
                'by_metric': {},
                'by_data_quality': {}
            }

        severity_counts = {}
        metric_counts = {}
        quality_counts = {}

        for alert in alerts:
            # Count by severity
            severity = alert['severity']
            severity_counts[severity] = severity_counts.get(severity, 0) + 1

            # Count by metric
            metric = alert['metric']
            metric_counts[metric] = metric_counts.get(metric, 0) + 1

            # Count by data quality
            quality = alert.get('data_quality', 'unknown')
            quality_counts[quality] = quality_counts.get(quality, 0) + 1

        return {
            'total_alerts': len(alerts),
            'by_severity': severity_counts,
            'by_metric': metric_counts,
            'by_data_quality': quality_counts
        }