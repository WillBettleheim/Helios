"""
HELIOS - Human Evaluation and Life-Indication Observation System
Main Streamlit application for astronaut health monitoring
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import sys
import os
from datetime import datetime, timedelta

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from monitoring.health_monitor import HealthMonitor

# Page configuration
st.set_page_config(
    page_title="HELIOS - Human Evaluation and Life-Indication Observation System",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for space theme
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(135deg, #0A0E27 0%, #1a2347 100%);
        padding: 2rem;
        border-radius: 15px;
        margin-bottom: 2rem;
        box-shadow: 0 4px 20px rgba(0, 206, 209, 0.3);
    }
    .metric-card {
        background: #1a2347;
        padding: 1.5rem;
        border-radius: 10px;
        border: 1px solid rgba(0, 206, 209, 0.3);
    }
    .alert-critical {
        background: linear-gradient(135deg, #441111 0%, #662222 100%);
        border-left: 4px solid #FF4444;
    }
    .alert-high {
        background: linear-gradient(135deg, #442211 0%, #663322 100%);
        border-left: 4px solid #FF8800;
    }
    .alert-medium {
        background: linear-gradient(135deg, #443311 0%, #665522 100%);
        border-left: 4px solid #FFAA00;
    }
    .alert-low {
        background: linear-gradient(135deg, #114433 0%, #225544 100%);
        border-left: 4px solid #00AA88;
    }
    .status-indicator {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 8px;
    }
    .status-normal { background-color: #00AA88; }
    .status-monitoring { background-color: #FFAA00; }
    .status-high { background-color: #FF8800; }
    .status-critical { background-color: #FF4444; }
</style>
""", unsafe_allow_html=True)

def main():
    # Initialize session state
    if 'monitor' not in st.session_state:
        st.session_state.monitor = HealthMonitor()
        st.session_state.monitor.initialize()

    monitor = st.session_state.monitor

    # Header
    st.markdown("""
    <div class="main-header">
        <h1 style="color: #00CED1; margin: 0;">🚀 HELIOS</h1>
        <h2 style="color: #FFD700; margin: 0.5rem 0 0 0;">Human Evaluation and Life-Indication Observation System</h2>
        <p style="color: #E0E0E0; margin: 1rem 0 0 0;">Intelligent Health Monitoring for Space Missions</p>
    </div>
    """, unsafe_allow_html=True)

    # Sidebar - Mission Overview
    with st.sidebar:
        st.markdown("## Mission Overview")

        # Astronaut selector
        astronauts = monitor.get_astronaut_list()
        selected_astronaut = st.selectbox(
            "Select Astronaut",
            [a['name'] for a in astronauts],
            index=0 if astronauts else 0
        )

        # Set current astronaut
        astronaut_id = None
        for a in astronauts:
            if a['name'] == selected_astronaut:
                astronaut_id = a['astronaut_id']
                monitor.set_astronaut(astronaut_id)
                break

        # Mission day
        if astronaut_id:
            profile = monitor.get_astronaut_profile(astronaut_id)
            mission_start = pd.to_datetime(profile['mission_start'])
            mission_days = (datetime.now() - mission_start).days
            st.metric("Mission Day", f"{mission_days}")

            # Data freshness
            latest_data = monitor.get_latest_metrics(astronaut_id, 1)
            if latest_data is not None and not latest_data.empty:
                latest_ts = pd.to_datetime(latest_data['timestamp'].iloc[0])
                freshness = datetime.now() - latest_ts
                if freshness < timedelta(hours=1):
                    freshness_text = f"{freshness.seconds // 60} minutes ago"
                else:
                    freshness_text = f"{freshness.days} days ago"
                st.metric("Last Update", freshness_text)

        # Model info
        model_info = monitor.get_model_info()
        st.markdown("---")
        st.markdown("## System Information")
        st.write(f"Model Status: {'✅ Loaded' if model_info['model_loaded'] else '❌ Not Loaded'}")
        if model_info['model_loaded']:
            training_size = model_info.get('training_stats', {}).get('training_size')
            if training_size is not None:
                st.write(f"Training Data: {training_size} records")
            else:
                st.write("Training Data: size not available")

    # Main content area
    if astronaut_id:
        # Mission Status
        mission_status = monitor.get_mission_status(astronaut_id)

        st.markdown("## Mission Health Status")
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            # Render overall status with a visual indicator using raw HTML
            st.markdown(
                f"""<div style='display:flex; align-items:center;'>
                    <span class='status-indicator status-{mission_status['status']}'></span>
                    <span style='margin-left:4px;'>{mission_status['status'].replace('_', ' ').title()}</span>
                </div>""",
                unsafe_allow_html=True
            )

        with col2:
            st.metric("Active Alerts", mission_status['active_alerts'])

        with col3:
            st.metric("Critical Alerts", mission_status['critical_alerts'])

        with col4:
            st.metric("Data Quality", mission_status['data_quality']['total_records'] if mission_status['data_quality'] else 0)

        # Health Risk Index (HRI) – a composite score summarising metric deviations and anomaly detection
        hri = monitor.compute_health_risk_index(astronaut_id)
        if hri:
            # Render HRI gauge
            fig_hri = monitor.visualizer.create_health_risk_gauge(hri)
            st.plotly_chart(fig_hri, use_container_width=True)
            st.caption(f"Risk Score: {hri['risk_score']} / 100 – {hri['severity'].title()}")
        st.markdown("## Health Monitoring")

        # Time range selector
        col1, col2 = st.columns([3, 1])
        with col1:
            time_range = st.selectbox(
                "Time Range",
                ["Last 24 hours", "Last 7 days", "Last 30 days", "All time"],
                index=1
            )

        with col2:
            if st.button("Refresh Data"):
                st.rerun()

        # Parse time range
        days_map = {"Last 24 hours": 1, "Last 7 days": 7, "Last 30 days": 30, "All time": None}
        days = days_map[time_range]

        # Get data
        data = monitor.get_time_range_data(astronaut_id, days=days)

        if data is not None and not data.empty:
            # Metrics overview
            st.markdown("### Latest Measurements")

            # Display latest metrics in cards
            latest = data.iloc[0]
            metrics = {
                'Heart Rate': (latest['heart_rate'], 'bpm'),
                'Blood Oxygen': (latest['blood_oxygen'], '%'),
                'Systolic BP': (latest['systolic_bp'], 'mmHg'),
                'Diastolic BP': (latest['diastolic_bp'], 'mmHg'),
                'Body Temperature': (latest['body_temp'], '°F'),
                'Sleep Duration': (latest['sleep_duration'], 'hours'),
                'Sleep Quality': (latest['sleep_quality'], '/10'),
                'Physical Activity': (latest['physical_activity'], '/10'),
                'Stress Level': (latest['stress_level'], '/10'),
                'Mood Score': (latest['mood_score'], '/10')
            }

            # Create metric cards
            cols = st.columns(5)
            for i, (name, (value, unit)) in enumerate(metrics.items()):
                col = cols[i % 5]
                with col:
                    st.metric(name, f"{value:.1f} {unit}")

            # Anomaly Detection
            st.markdown("---")
            st.markdown("## ML Intelligence")

            anomaly_results = monitor.detect_anomalies(astronaut_id, days=7)

            if anomaly_results and np.any(anomaly_results['anomaly_results']['is_anomaly_bool']):
                # Show anomalies
                anomaly_count = np.sum(anomaly_results['anomaly_results']['is_anomaly_bool'])
                st.warning(f"⚠️ Detected {anomaly_count} unusual patterns in recent data")

                # Show explanations for top anomalies
                explanations = anomaly_results['anomaly_results']['explanations']
                if explanations:
                    st.markdown("### Anomaly Explanations")
                    for exp in explanations[:3]:  # Show top 3
                        st.markdown(f"""
                        <div class="metric-card">
                            <h4>⚠️ {exp['timestamp'].strftime('%Y-%m-%d %H:%M')}</h4>
                            <p><strong>Score:</strong> {exp['anomaly_score']:.3f}</p>
                            <p><strong>Contributing Factors:</strong></p>
                            """, unsafe_allow_html=True)

                        for contrib in exp['top_contributors']:
                            st.markdown(f"• {contrib['description']}")

                        st.markdown("<br><strong>Recommended Action:</strong> Monitor for persistent changes and consult mission protocols if symptoms worsen.</div><br>", unsafe_allow_html=True)
            else:
                st.success("✅ No unusual patterns detected in recent data")

            # Interactive charts
            st.markdown("---")
            st.markdown("## Health Trends")

            # Chart type selector
            chart_type = st.selectbox(
                "Chart Type",
                ["Timeline View", "Multi-Metric Dashboard", "Anomaly Detection", "Longitudinal Trend"]
            )

            if chart_type == "Timeline View":
                # Single metric selector
                metric = st.selectbox(
                    "Select Metric",
                    list(metrics.keys()),
                    index=0
                )

                # Create timeline
                # Map display name to column key with special handling for Body Temperature
                metric_to_key = {
                    'Heart Rate': 'heart_rate',
                    'Blood Oxygen': 'blood_oxygen',
                    'Systolic BP': 'systolic_bp',
                    'Diastolic BP': 'diastolic_bp',
                    'Body Temperature': 'body_temp',
                    'Sleep Duration': 'sleep_duration',
                    'Sleep Quality': 'sleep_quality',
                    'Physical Activity': 'physical_activity',
                    'Stress Level': 'stress_level',
                    'Mood Score': 'mood_score'
                }
                metric_key = metric_to_key[metric]
                fig = monitor.create_metric_timeline(
                    metric_key,
                    days=7
                )
                if fig:
                    st.plotly_chart(fig, use_container_width=True)

            elif chart_type == "Multi-Metric Dashboard":
                fig = monitor.create_multi_metric_dashboard(days=7)
                if fig:
                    st.plotly_chart(fig, use_container_width=True)

            elif chart_type == "Anomaly Detection":
                metric = st.selectbox(
                    "Select Metric for Anomaly View",
                    ['heart_rate', 'blood_oxygen', 'systolic_bp'],
                    index=0
                )
                fig = monitor.create_anomaly_scatter(metric, days=7)
                if fig:
                    st.plotly_chart(fig, use_container_width=True)

            elif chart_type == "Longitudinal Trend":
                metric = st.selectbox(
                    "Select Metric for Trend Analysis",
                    list(metrics.keys()),
                    index=0
                )
                # Map display name to column key with special handling for Body Temperature
                metric_to_key = {
                    'Heart Rate': 'heart_rate',
                    'Blood Oxygen': 'blood_oxygen',
                    'Systolic BP': 'systolic_bp',
                    'Diastolic BP': 'diastolic_bp',
                    'Body Temperature': 'body_temp',
                    'Sleep Duration': 'sleep_duration',
                    'Sleep Quality': 'sleep_quality',
                    'Physical Activity': 'physical_activity',
                    'Stress Level': 'stress_level',
                    'Mood Score': 'mood_score'
                }
                metric_key = metric_to_key[metric]
                analysis = monitor.get_longitudinal_analysis(astronaut_id, metric=metric_key, days=30)
                if analysis:
                    fig = monitor.visualizer.create_longitudinal_trend(analysis, metric)
                    if fig:
                        st.plotly_chart(fig, use_container_width=True)
                        st.caption(f"Sustained change points: {analysis['percent_sustained']}% (threshold: 1σ over baseline)")
                else:
                    st.warning("Insufficient data for longitudinal trend analysis.")

            # Alerts Section
            st.markdown("---")
            st.markdown("## Alert Center")

            active_alerts = monitor.get_active_alerts(astronaut_id)

            if active_alerts:
                for alert in active_alerts[:5]:  # Show top 5
                    alert_class = f"alert-{alert['severity']}"
                    metric_key = alert["metric"]
                    unit_key = f'{metric_key}_unit'
                    unit = alert.get(unit_key, '')
                    st.markdown(f"""
                    <div class="{alert_class} metric-card">
                        <h4>🚨 {alert['name']}</h4>
                        <p><strong>Severity:</strong> {alert['severity'].upper()}</p>
                        <p><strong>Value:</strong> {alert['value']} {unit}</p>
                        <p><strong>Message:</strong> {alert['message']}</p>
                        <p><strong>Action:</strong> {alert['recommended_action']}</p>
                        <p><strong>Time:</strong> {alert['timestamp'].strftime('%Y-%m-%d %H:%M')}</p>
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.info("ℹ️ No active alerts")

        else:
            st.warning("No data available for selected astronaut and time range")

    else:
        st.info("Please select an astronaut from the sidebar to begin monitoring")

if __name__ == "__main__":
    main()