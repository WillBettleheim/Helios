"""
Visualization utilities for HELIOS
Creates interactive charts using Plotly
"""

import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import numpy as np
from datetime import datetime, timedelta
import json

class HealthVisualizer:
    def __init__(self, theme="dark"):
        self.theme = theme
        self.colors = {
            'primary': '#00CED1',      # Cyan
            'secondary': '#FFD700',    # Solar gold
            'critical': '#FF4444',
            'high': '#FF8800',
            'medium': '#FFAA00',
            'low': '#00AA88',
            'background': '#0A0E27',   # Dark navy
            'text': '#E0E0E0'
        }

    def create_metric_timeline(self, data, metric, title=None, show_baseline=True):
        """Create a timeline chart for a specific metric"""
        if title is None:
            title = f"{metric.replace('_', ' ').title()} Timeline"

        # Prepare data
        df = data.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])

        # Create figure
        fig = go.Figure()

        # Add metric line
        fig.add_trace(go.Scatter(
            x=df['timestamp'],
            y=df[metric],
            mode='lines+markers',
            name='Measurement',
            line=dict(color=self.colors['primary'], width=2),
            marker=dict(size=6, opacity=0.8),
            hovertemplate=f'<b>{metric}</b><br>' +
                         'Time: %{x}<br>' +
                         'Value: %{y:.1f}<br>' +
                         '<extra></extra>'
        ))

        # Add baseline if requested and available
        if show_baseline and 'baseline_metrics' in df.columns:
            # Assuming baseline_metrics is stored as JSON string
            baseline_values = []
            for idx, row in df.iterrows():
                if pd.notna(row['baseline_metrics']):
                    try:
                        baseline = json.loads(row['baseline_metrics'])
                        if metric in baseline:
                            baseline_values.append(baseline[metric]['mean'])
                        else:
                            baseline_values.append(None)
                    except:
                        baseline_values.append(None)
                else:
                    baseline_values.append(None)

            baseline_values = pd.Series(baseline_values)

            fig.add_trace(go.Scatter(
                x=df['timestamp'],
                y=baseline_values,
                mode='lines',
                name='Baseline',
                line=dict(color=self.colors['secondary'], width=2, dash='dash'),
                hovertemplate=f'<b>Baseline</b><br>' +
                             'Time: %{x}<br>' +
                             'Value: %{y:.1f}<br>' +
                             '<extra></extra>'
            ))

        # Update layout
        fig.update_layout(
            title=title,
            xaxis_title='Time',
            yaxis_title=metric.replace('_', ' ').title(),
            plot_bgcolor=self.colors['background'],
            paper_bgcolor=self.colors['background'],
            font=dict(color=self.colors['text']),
            xaxis=dict(gridcolor='rgba(255,255,255,0.1)'),
            yaxis=dict(gridcolor='rgba(255,255,255,0.1)'),
            showlegend=True,
            height=400
        )

        return fig

    def create_multi_metric_dashboard(self, data, metrics, days=7):
        """Create dashboard with multiple metrics"""
        # Filter data for last N days
        cutoff = pd.to_datetime(data['timestamp'].max()) - timedelta(days=days)
        df = data[data['timestamp'] >= cutoff].copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])

        # Create subplots
        n_metrics = len(metrics)
        rows = (n_metrics + 1) // 2  # 2 columns

        fig = make_subplots(
            rows=rows,
            cols=2,
            subplot_titles=[m.replace('_', ' ').title() for m in metrics],
            vertical_spacing=0.08
        )

        # Add each metric
        for i, metric in enumerate(metrics):
            row = i // 2 + 1
            col = i % 2 + 1

            fig.add_trace(
                go.Scatter(
                    x=df['timestamp'],
                    y=df[metric],
                    mode='lines+markers',
                    name=metric,
                    line=dict(color=self.colors['primary']),
                    marker=dict(size=4)
                ),
                row=row,
                col=col
            )

        # Update layout
        fig.update_layout(
            title=f"Health Metrics Dashboard - Last {days} Days",
            plot_bgcolor=self.colors['background'],
            paper_bgcolor=self.colors['background'],
            font=dict(color=self.colors['text']),
            height=300 * rows,
            showlegend=False
        )

        return fig

    def create_health_risk_gauge(self, risk_dict):
        """Create a Plotly gauge visualising the Health Risk Index.
        Expected input: {'risk_score': <float 0‑100>, 'severity': 'low'|'moderate'|'high'}
        The gauge colour follows the severity: green, orange, red.
        """
        if not risk_dict:
            return go.Figure()
        score = risk_dict.get('risk_score', 0)
        severity = risk_dict.get('severity', 'low')
        color_map = {
            'low': '#00AA88',      # greenish
            'moderate': '#FFAA00', # orange
            'high': '#FF4444'      # red
        }
        gauge_color = color_map.get(severity, '#00AA88')
        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=score,
            title={'text': "Health Risk Index"},
            gauge={
                'axis': {'range': [0, 100]},
                'bar': {'color': gauge_color},
                'steps': [
                    {'range': [0, 33], 'color': '#00AA88'},
                    {'range': [33, 66], 'color': '#FFAA00'},
                    {'range': [66, 100], 'color': '#FF4444'}
                ]
            }
        ))
        # Apply the same dark theme styling as other plots
        fig.update_layout(
            plot_bgcolor=self.colors['background'],
            paper_bgcolor=self.colors['background'],
            font=dict(color=self.colors['text'])
        )
        return fig

    def create_longitudinal_trend(self, analysis_dict, metric_name):
        """
        Create a trend chart for longitudinal analysis.
        Expected input from HealthMonitor.get_longitudinal_analysis.
        Shows raw values, baseline, rolling mean, and highlights sustained changes.
        """
        if not analysis_dict:
            return go.Figure()
        timestamps = analysis_dict['timestamps']
        values = analysis_dict['values']
        baseline_mean = analysis_dict['baseline_mean']
        baseline_std = analysis_dict['baseline_std']
        rolling_mean = analysis_dict['rolling_mean']
        sustained = analysis_dict['sustained_change']
        # Prepare data for highlighting
        # We'll create a scatter for points where sustained == True
        sustained_ts = timestamps[sustained]
        sustained_vals = values[sustained]
        fig = go.Figure()
        # Raw values
        fig.add_trace(go.Scatter(
            x=timestamps,
            y=values,
            mode='lines+markers',
            name=f'{metric_name} (raw)',
            line=dict(color=self.colors['primary'], width=2),
            marker=dict(size=6)
        ))
        # Baseline
        fig.add_trace(go.Scatter(
            x=timestamps,
            y=[baseline_mean]*len(timestamps),
            mode='lines',
            name='Baseline',
            line=dict(color=self.colors['secondary'], width=2, dash='dash')
        ))
        # Rolling mean
        fig.add_trace(go.Scatter(
            x=timestamps,
            y=rolling_mean,
            mode='lines',
            name=f'Rolling Mean (window=3)',
            line=dict(color=self.colors['critical'], width=2)
        ))
        # Highlight sustained changes
        if len(sustained_ts) > 0:
            fig.add_trace(go.Scatter(
                x=sustained_ts,
                y=sustained_vals,
                mode='markers',
                name='Sustained Change',
                marker=dict(
                    color=self.colors['high'],
                    size=10,
                    symbol='x'
                )
            ))
        # Update layout
        fig.update_layout(
            title=f"{metric_name.replace('_', ' ').title()} Longitudinal Trend",
            xaxis_title="Time",
            yaxis_title=metric_name.replace('_', ' ').title(),
            plot_bgcolor=self.colors['background'],
            paper_bgcolor=self.colors['background'],
            font=dict(color=self.colors['text']),
            xaxis=dict(gridcolor='rgba(255,255,255,0.1)'),
            yaxis=dict(gridcolor='rgba(255,255,255,0.1)'),
            hovermode="x unified"
        )
        return fig


    def create_correlation_heatmap(self, data, metrics):
        """Create correlation heatmap for health metrics"""
        # Select metric columns
        df = data[metrics].copy()

        # Calculate correlation matrix
        corr_matrix = df.corr()

        # Create heatmap
        fig = go.Figure(data=go.Heatmap(
            z=corr_matrix.values,
            x=corr_matrix.columns,
            y=corr_matrix.columns,
            colorscale='RdBu',
            zmid=0,
            colorbar=dict(title="Correlation")
        ))

        fig.update_layout(
            title="Health Metrics Correlation Matrix",
            plot_bgcolor=self.colors['background'],
            paper_bgcolor=self.colors['background'],
            font=dict(color=self.colors['text'])
        )

        return fig

    def create_alert_timeline(self, alerts):
        """Create timeline of alerts"""
        if not alerts:
            # Return empty figure
            fig = go.Figure()
            fig.update_layout(
                title="Alert Timeline",
                plot_bgcolor=self.colors['background'],
                paper_bgcolor=self.colors['background'],
                font=dict(color=self.colors['text'])
            )
            return fig

        # Convert alerts to DataFrame
        df = pd.DataFrame(alerts)
        df['timestamp'] = pd.to_datetime(df['timestamp'])

        # Create timeline
        fig = go.Figure()

        # Add alerts by severity
        for severity in ['critical', 'high', 'medium', 'low']:
            severity_alerts = df[df['severity'] == severity]
            if not severity_alerts.empty:
                color = {
                    'critical': self.colors['critical'],
                    'high': self.colors['high'],
                    'medium': self.colors['medium'],
                    'low': self.colors['low']
                }[severity]

                fig.add_trace(go.Scatter(
                    x=severity_alerts['timestamp'],
                    y=severity_alerts['name'],
                    mode='markers',
                    name=severity.capitalize(),
                    marker=dict(
                        color=color,
                        size=12,
                        symbol='diamond'
                    ),
                    hovertemplate=f'<b>{severity.capitalize()} Alert</b><br>' +
                                 'Time: %{x}<br>' +
                                 'Alert: %{y}<br>' +
                                 '<extra></extra>'
                ))

        fig.update_layout(
            title="Alert Timeline",
            xaxis_title="Time",
            yaxis_title="Alert Type",
            plot_bgcolor=self.colors['background'],
            paper_bgcolor=self.colors['background'],
            font=dict(color=self.colors['text']),
            xaxis=dict(gridcolor='rgba(255,255,255,0.1)'),
            showlegend=True,
            height=500
        )

        return fig

    def create_anomaly_scatter(self, data, anomaly_results, metric):
        """
        Create a scatter plot highlighting anomalies in a metric.

        Args:
            data (DataFrame): Health metrics data with timestamp column
            anomaly_results (dict): Results from anomaly detection including 'is_anomaly_bool'
            metric (str): Column name of the metric to plot

        Returns:
            plotly.graph_objects.Figure: Scatter plot with anomalies highlighted
        """
        if data is None or data.empty or metric not in data.columns:
            return go.Figure()

        # Prepare data
        df = data.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])

        # Get anomaly flags
        is_anomaly = anomaly_results.get('is_anomaly_bool', [])
        if len(is_anomaly) != len(df):
            # If lengths don't match, assume no anomalies
            is_anomaly = [False] * len(df)

        # Create figure
        fig = go.Figure()

        # Add normal points
        normal_mask = ~np.array(is_anomaly, dtype=bool)
        if np.any(normal_mask):
            fig.add_trace(go.Scatter(
                x=df.loc[normal_mask, 'timestamp'],
                y=df.loc[normal_mask, metric],
                mode='markers',
                name='Normal',
                marker=dict(
                    color=self.colors['primary'],
                    size=8,
                    opacity=0.7
                ),
                hovertemplate=f'<b>{metric}</b><br>' +
                             'Time: %{x}<br>' +
                             'Value: %{y:.1f}<br>' +
                             '<extra></extra>'
            ))

        # Add anomalous points
        anomalous_mask = np.array(is_anomaly, dtype=bool)
        if np.any(anomalous_mask):
            fig.add_trace(go.Scatter(
                x=df.loc[anomalous_mask, 'timestamp'],
                y=df.loc[anomalous_mask, metric],
                mode='markers',
                name='Anomaly',
                marker=dict(
                    color=self.colors['critical'],
                    size=12,
                    symbol='x',
                    line=dict(width=2, color=self.colors['primary'])
                ),
                hovertemplate=f'<b>{metric} (ANOMALY)</b><br>' +
                             'Time: %{x}<br>' +
                             'Value: %{y:.1f}<br>' +
                             '<extra></extra>'
            ))

        # Update layout
        fig.update_layout(
            title=f"{metric.replace('_', ' ').title()} - Anomaly Detection",
            xaxis_title='Time',
            yaxis_title=metric.replace('_', ' ').title(),
            plot_bgcolor=self.colors['background'],
            paper_bgcolor=self.colors['background'],
            font=dict(color=self.colors['text']),
            xaxis=dict(gridcolor='rgba(255,255,255,0.1)'),
            yaxis=dict(gridcolor='rgba(255,255,255,0.1)'),
            showlegend=True,
            height=400
        )

        return fig