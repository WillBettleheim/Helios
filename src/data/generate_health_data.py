"""
Synthetic Astronaut Health Data Generator for HELIOS
Generates realistic synthetic health data for demonstration purposes
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json
import os

def generate_astronaut_profile(astronaut_id="ASTR001", name="Commander Alex Vega"):
    """Generate astronaut profile with baseline health metrics"""
    np.random.seed(hash(astronaut_id) % 2**32)  # Reproducible per astronaut

    return {
        "astronaut_id": astronaut_id,
        "name": name,
        "age": np.random.randint(30, 50),
        "sex": np.random.choice(["M", "F"]),
        "mission_start": datetime.now() - timedelta(days=130),
        "baseline_metrics": {
            "heart_rate": {"mean": np.random.normal(65, 8), "std": np.random.uniform(4, 8)},
            "blood_oxygen": {"mean": np.random.normal(97.5, 1.2), "std": np.random.uniform(0.8, 1.5)},
            "systolic_bp": {"mean": np.random.normal(118, 10), "std": np.random.uniform(6, 12)},
            "diastolic_bp": {"mean": np.random.normal(75, 8), "std": np.random.uniform(4, 8)},
            "body_temp": {"mean": np.random.normal(98.6, 0.3), "std": np.random.uniform(0.2, 0.4)},
            "sleep_duration": {"mean": np.random.normal(7.5, 0.8), "std": np.random.uniform(0.5, 1.2)},
            "sleep_quality": {"mean": np.random.normal(7.8, 1.0), "std": np.random.uniform(0.6, 1.2)},
            "physical_activity": {"mean": np.random.normal(6.2, 1.5), "std": np.random.uniform(0.8, 2.0)},
            "stress_level": {"mean": np.random.normal(3.2, 1.2), "std": np.random.uniform(0.5, 1.5)},
            "mood_score": {"mean": np.random.normal(7.5, 1.2), "std": np.random.uniform(0.8, 1.5)}
        }
    }

def generate_health_record(timestamp, profile, anomaly_probability=0.05):
    """Generate a single health record with optional anomaly injection"""
    baseline = profile["baseline_metrics"]
    record = {
        "timestamp": timestamp,
        "astronaut_id": profile["astronaut_id"],
        "data_quality": np.random.choice(["excellent", "good", "fair"], p=[0.7, 0.25, 0.05]),
        "data_source": np.random.choice(["wearable_sensor", "manual_entry", "simulated"], p=[0.6, 0.3, 0.1])
    }

    # Determine if this record should be anomalous
    is_anomaly = np.random.random() < anomaly_probability

    # Generate each metric
    metrics = {
        "heart_rate": ("bpm", 40, 120),
        "blood_oxygen": ("%", 85, 100),
        "systolic_bp": ("mmHg", 80, 200),
        "diastolic_bp": ("mmHg", 50, 120),
        "body_temp": ("°F", 96, 105),
        "sleep_duration": ("hours", 3, 12),
        "sleep_quality": ("scale", 1, 10),
        "physical_activity": ("scale", 0, 10),
        "stress_level": ("scale", 1, 10),
        "mood_score": ("scale", 1, 10)
    }

    for metric, (unit, min_val, max_val) in metrics.items():
        base_mean = baseline[metric]["mean"]
        base_std = baseline[metric]["std"]

        if is_anomaly:
            # Inject anomaly: shift mean and/or increase variance
            anomaly_type = np.random.choice(["shift", "variance", "both"])
            if anomaly_type in ["shift", "both"]:
                shift_direction = np.random.choice([-1, 1])
                shift_magnitude = np.random.uniform(1.5, 3.0) * base_std
                base_mean += shift_direction * shift_magnitude
            if anomaly_type in ["variance", "both"]:
                base_std *= np.random.uniform(2.0, 4.0)

        # Generate value with clipping to realistic ranges
        value = np.random.normal(base_mean, base_std)
        value = np.clip(value, min_val, max_val)

        record[metric] = round(value, 2)
        record[f"{metric}_unit"] = unit

    record["is_anomaly"] = is_anomaly
    return record

def generate_health_dataset(astronauts=None, days=180, records_per_day=3):
    """Generate complete health dataset for multiple astronauts"""
    if astronauts is None:
        astronauts = [
            generate_astronaut_profile("ASTR001", "Commander Alex Vega"),
            generate_astronaut_profile("ASTR002", "Dr. Maya Rodriguez"),
            generate_astronaut_profile("ASTR003", "Lt. Kenji Tanaka")
        ]

    all_records = []

    for profile in astronauts:
        start_date = profile["mission_start"]
        end_date = start_date + timedelta(days=days)

        # Generate records at regular intervals
        current_date = start_date
        while current_date <= end_date:
            # Multiple records per day (morning, afternoon, evening)
            for i in range(records_per_day):
                # Spread records throughout the day
                hours_offset = i * (24 / records_per_day)
                timestamp = current_date + timedelta(hours=hours_offset)

                record = generate_health_record(timestamp, profile, anomaly_probability=0.08)
                all_records.append(record)

            current_date += timedelta(days=1)

    df = pd.DataFrame(all_records)
    return df, astronauts

def save_dataset(df, astronauts, filepath="data/health_data.csv"):
    """Save dataset and astronaut profiles"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    df.to_csv(filepath, index=False)

    # Save astronaut profiles
    profiles_path = filepath.replace(".csv", "_profiles.json")
    with open(profiles_path, 'w') as f:
        json.dump(astronauts, f, indent=2, default=str)

    print(f"Dataset saved to {filepath}")
    print(f"Profiles saved to {profiles_path}")
    print(f"Total records: {len(df)}")
    print(f"Anomalous records: {df['is_anomaly'].sum()} ({df['is_anomaly'].mean()*100:.2f}%)")

if __name__ == "__main__":
    # Generate and save dataset
    df, astronauts = generate_health_dataset(days=120, records_per_day=3)
    save_dataset(df, astronauts)