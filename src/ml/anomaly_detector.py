"""
Anomaly Detection Module for HELIOS
Implements Isolation Forest for detecting unusual health patterns
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import json
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class HealthAnomalyDetector:
    def __init__(self, contamination=0.1, random_state=42):
        """
        Initialize the anomaly detector

        Args:
            contamination: Expected proportion of anomalies in the data
            random_state: Random seed for reproducibility
        """
        self.contamination = contamination
        self.random_state = random_state
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'heart_rate', 'blood_oxygen', 'systolic_bp', 'diastolic_bp',
            'body_temp', 'sleep_duration', 'sleep_quality',
            'physical_activity', 'stress_level', 'mood_score'
        ]
        self.is_trained = False
        self.training_stats = {}

    def prepare_features(self, df):
        """
        Prepare features for training/prediction

        Args:
            df: DataFrame with health data

        Returns:
            Numpy array of features
        """
        # Select only the health metric columns
        feature_df = df[self.feature_names].copy()

        # Handle missing values by filling with median
        feature_df = feature_df.fillna(feature_df.median())

        return feature_df.values

    def train(self, df, validation_split=0.2):
        """
        Train the Isolation Forest model

        Args:
            df: DataFrame with training data
            validation_split: Fraction of data to use for validation
        """
        # Prepare features
        X = self.prepare_features(df)

        # Split for validation
        split_idx = int(len(X) * (1 - validation_split))
        X_train = X[:split_idx]
        X_val = X[split_idx:] if validation_split > 0 else None

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)

        # Train Isolation Forest
        self.model = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=100,
            max_samples='auto'
        )

        self.model.fit(X_train_scaled)
        self.is_trained = True

        # Calculate training statistics for baseline comparisons
        self.training_stats = {
            'means': dict(zip(self.feature_names, np.mean(X_train, axis=0))),
            'stds': dict(zip(self.feature_names, np.std(X_train, axis=0))),
            'medians': dict(zip(self.feature_names, np.median(X_train, axis=0))),
            'training_size': len(X_train)
        }

        # Evaluate on validation set if available
        if X_val is not None and len(X_val) > 0:
            X_val_scaled = self.scaler.transform(X_val)
            val_predictions = self.model.predict(X_val_scaled)
            val_scores = self.model.decision_function(X_val_scaled)

            # Convert predictions: -1 for anomaly, 1 for normal
            val_anomalies = (val_predictions == -1).astype(int)

            return {
                'training_size': len(X_train),
                'validation_size': len(X_val),
                'val_anomaly_rate': np.mean(val_anomalies),
                'val_anomaly_count': np.sum(val_anomalies),
                'mean_anomaly_score': np.mean(val_scores),
                'std_anomaly_score': np.std(val_scores)
            }

        return {
            'training_size': len(X_train),
            'validation_size': 0
        }

    def predict(self, df):
        """
        Predict anomalies in new data

        Args:
            df: DataFrame with health data to analyze

        Returns:
            Dictionary with predictions, scores, and explanations
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        # Prepare features
        X = self.prepare_features(df)
        X_scaled = self.scaler.transform(X)

        # Get predictions and anomaly scores
        predictions = self.model.predict(X_scaled)  # -1 for anomaly, 1 for normal
        anomaly_scores = self.model.decision_function(X_scaled)  # Lower = more anomalous

        # Convert to binary (1 for anomaly, 0 for normal)
        is_anomaly = (predictions == -1).astype(int)

        # Generate explanations for anomalies
        explanations = self._explain_anomalies(df, X, X_scaled, is_anomaly)

        return {
            'predictions': is_anomaly,
            'anomaly_scores': anomaly_scores,
            'is_anomaly_bool': is_anomaly.astype(bool),
            'explanations': explanations
        }

    def _explain_anomalies(self, df, X_raw, X_scaled, is_anomaly):
        """
        Generate explanations for why records are flagged as anomalous

        Args:
            df: Original DataFrame
            X_raw: Raw feature values
            X_scaled: Scaled feature values
            is_anomaly: Boolean array indicating anomalies

        Returns:
            List of explanation dictionaries
        """
        explanations = []

        if not np.any(is_anomaly):
            return explanations

        # For each anomalous record, calculate feature deviations
        anomaly_indices = np.where(is_anomaly)[0]

        for idx in anomaly_indices:
            record_explanation = {
                'record_index': int(idx),
                'timestamp': df.iloc[idx]['timestamp'],
                'anomaly_score': float(X_scaled[idx].mean()),  # Simplified score
                'feature_deviations': {},
                'top_contributors': []
            }

            # Calculate how much each feature deviates from baseline (in standard deviations)
            for i, feature in enumerate(self.feature_names):
                if feature in self.training_stats['means']:
                    mean_val = self.training_stats['means'][feature]
                    std_val = self.training_stats['stds'][feature]

                    if std_val > 0:
                        deviation = (X_raw[idx, i] - mean_val) / std_val
                        record_explanation['feature_deviations'][feature] = {
                            'value': float(X_raw[idx, i]),
                            'baseline_mean': float(mean_val),
                            'baseline_std': float(std_val),
                            'deviation_std': float(deviation),
                            'deviation_percent': float((deviation * 100))  # Approximate
                        }

            # Sort features by absolute deviation to find top contributors
            deviations = record_explanation['feature_deviations']
            sorted_features = sorted(
                deviations.items(),
                key=lambda x: abs(x[1]['deviation_std']),
                reverse=True
            )

            # Top 3 contributors
            record_explanation['top_contributors'] = [
                {
                    'feature': feature,
                    'deviation_std': details['deviation_std'],
                    'description': self._get_deviation_description(
                        feature, details['deviation_std'],
                        details['value'], details['baseline_mean']
                    )
                }
                for feature, details in sorted_features[:3]
            ]

            explanations.append(record_explanation)

        return explanations

    def _get_deviation_description(self, feature, deviation_std, value, baseline):
        """Generate human-readable description of deviation"""
        abs_dev = abs(deviation_std)

        if abs_dev < 0.5:
            severity = "normal variation"
        elif abs_dev < 1.0:
            severity = "slightly unusual"
        elif abs_dev < 1.5:
            severity = "moderately unusual"
        elif abs_dev < 2.0:
            severity = "quite unusual"
        else:
            severity = "highly unusual"

        direction = "above" if deviation_std > 0 else "below"
        feature_names = {
            'heart_rate': 'heart rate',
            'blood_oxygen': 'blood oxygen',
            'systolic_bp': 'systolic blood pressure',
            'diastolic_bp': 'diastolic blood pressure',
            'body_temp': 'body temperature',
            'sleep_duration': 'sleep duration',
            'sleep_quality': 'sleep quality',
            'physical_activity': 'physical activity',
            'stress_level': 'stress level',
            'mood_score': 'mood score'
        }

        feature_display = feature_names.get(feature, feature)

        return f"{feature_display} is {severity} ({direction} baseline by {abs_dev:.1f}σ)"

    def save_model(self, model_path="models/anomaly_detector.pkl",
                   stats_path="models/training_stats.json"):
        """Save the trained model and training statistics"""
        if not self.is_trained:
            raise ValueError("No trained model to save")

        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        os.makedirs(os.path.dirname(stats_path), exist_ok=True)

        # Save model and scaler
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'contamination': self.contamination,
            'random_state': self.random_state,
            'is_trained': self.is_trained
        }

        joblib.dump(model_data, model_path)

        # Save training stats
        with open(stats_path, 'w') as f:
            json.dump({
                'training_stats': self.training_stats,
                'model_params': {
                    'contamination': self.contamination,
                    'random_state': self.random_state
                },
                'training_timestamp': datetime.now().isoformat()
            }, f, indent=2)

        print(f"Model saved to {model_path}")
        print(f"Training stats saved to {stats_path}")

    def load_model(self, model_path="models/anomaly_detector.pkl",
                   stats_path="models/training_stats.json"):
        """Load a pre-trained model and training statistics"""
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")

        # Load model and scaler
        model_data = joblib.load(model_path)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        self.contamination = model_data['contamination']
        self.random_state = model_data['random_state']
        self.is_trained = model_data['is_trained']

        # Load training stats
        if os.path.exists(stats_path):
            with open(stats_path, 'r') as f:
                stats_data = json.load(f)
                self.training_stats = stats_data.get('training_stats', {})

        print(f"Model loaded from {model_path}")
        return self

def train_model_on_data(data_path="data/health_data.csv"):
    """Convenience function to train model on generated data"""
    # Load data
    df = pd.read_csv(data_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    # Initialize and train detector
    detector = HealthAnomalyDetector(contamination=0.08)  # Match our generation rate
    training_results = detector.train(df, validation_split=0.2)

    # Save model
    detector.save_model()

    return detector, training_results

if __name__ == "__main__":
    # Train model when run directly
    detector, results = train_model_on_data()
    print("Training completed!")
    print(f"Results: {results}")