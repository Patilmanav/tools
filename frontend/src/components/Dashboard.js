import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/dashboard/stats`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch dashboard stats: ${errorText}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
      // Set default stats if there's an error
      setStats({
        today: { visitors: 0, new_visitors: 0, operations: 0, successful: 0, failed: 0, data_processed: 0 },
        yesterday: { visitors: 0, new_visitors: 0, operations: 0, successful: 0, failed: 0, data_processed: 0 },
        total: { users: 0, operations: 0, successful: 0, failed: 0, data_processed: 0, avg_processing_time: 0 },
        operation_breakdown: [],
        daily_stats: [],
        recent_operations: []
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms) => {
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  };

  const getPercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#10B981';
      case 'failed': return '#EF4444';
      case 'processing': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h3>Error loading dashboard</h3>
        <p>{error}</p>
        <button onClick={fetchDashboardStats}>Retry</button>
      </div>
    );
  }

  if (!stats) {
    return <div className="dashboard-error">No data available</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="developer-caption">
          Built with care by Manav Patil
        </div>
        <div className="dashboard-controls">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
            className="period-selector"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={fetchDashboardStats} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <h3>Today's Visitors</h3>
            <span className="metric-icon">👥</span>
          </div>
          <div className="metric-value">{formatNumber(stats.today.visitors)}</div>
          <div className="metric-change">
            <span className={`change ${stats.today.visitors > stats.yesterday.visitors ? 'positive' : 'negative'}`}>
              {getPercentageChange(stats.today.visitors, stats.yesterday.visitors)}%
            </span>
            <span className="change-label">vs yesterday</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>New Visitors</h3>
            <span className="metric-icon">🆕</span>
          </div>
          <div className="metric-value">{formatNumber(stats.today.new_visitors)}</div>
          <div className="metric-change">
            <span className={`change ${stats.today.new_visitors > stats.yesterday.new_visitors ? 'positive' : 'negative'}`}>
              {getPercentageChange(stats.today.new_visitors, stats.yesterday.new_visitors)}%
            </span>
            <span className="change-label">vs yesterday</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Operations Today</h3>
            <span className="metric-icon">⚙️</span>
          </div>
          <div className="metric-value">{formatNumber(stats.today.operations)}</div>
          <div className="metric-change">
            <span className={`change ${stats.today.operations > stats.yesterday.operations ? 'positive' : 'negative'}`}>
              {getPercentageChange(stats.today.operations, stats.yesterday.operations)}%
            </span>
            <span className="change-label">vs yesterday</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Success Rate</h3>
            <span className="metric-icon">✅</span>
          </div>
          <div className="metric-value">
            {stats.today.operations > 0 
              ? ((stats.today.successful / stats.today.operations) * 100).toFixed(1) + '%'
              : '0%'
            }
          </div>
          <div className="metric-change">
            <span className="change-label">
              {stats.today.successful} / {stats.today.operations} successful
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Data Processed</h3>
            <span className="metric-icon">💾</span>
          </div>
          <div className="metric-value">{formatBytes(stats.today.data_processed)}</div>
          <div className="metric-change">
            <span className={`change ${stats.today.data_processed > stats.yesterday.data_processed ? 'positive' : 'negative'}`}>
              {getPercentageChange(stats.today.data_processed, stats.yesterday.data_processed)}%
            </span>
            <span className="change-label">vs yesterday</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Total Users</h3>
            <span className="metric-icon">👤</span>
          </div>
          <div className="metric-value">{formatNumber(stats.total.users)}</div>
          <div className="metric-change">
            <span className="change-label">All time</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>Operation Types (Last 30 Days)</h3>
          <div className="operation-breakdown">
            {stats.operation_breakdown.map((op, index) => (
              <div key={index} className="operation-item">
                <div className="operation-info">
                  <span className="operation-name">{op.operation_type}</span>
                  <span className="operation-count">{op.count} operations</span>
                </div>
                <div className="operation-stats">
                  <div className="success-rate">
                    Success: {op.count > 0 ? ((op.successful / op.count) * 100).toFixed(1) : 0}%
                  </div>
                  <div className="avg-time">
                    Avg: {formatTime(op.avg_time || 0)}
                  </div>
                </div>
                <div className="operation-bar">
                  <div 
                    className="success-bar" 
                    style={{width: `${op.count > 0 ? (op.successful / op.count) * 100 : 0}%`}}
                  ></div>
                  <div 
                    className="failed-bar" 
                    style={{width: `${op.count > 0 ? (op.failed / op.count) * 100 : 0}%`}}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-container">
          <h3>Recent Activity</h3>
          <div className="recent-operations">
            {stats.recent_operations.map((op, index) => (
              <div key={index} className="activity-item">
                <div className="activity-icon">
                  {op.operation_type.includes('pdf') ? '📄' : '🖼️'}
                </div>
                <div className="activity-details">
                  <div className="activity-operation">{op.operation_type}</div>
                  <div className="activity-meta">
                    {op.file_count} files • {formatTime(op.processing_time_ms)} • {op.status}
                  </div>
                </div>
                <div className="activity-status">
                  <span 
                    className="status-dot" 
                    style={{backgroundColor: getStatusColor(op.status)}}
                  ></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="summary-section">
        <div className="summary-card">
          <h3>Performance Overview</h3>
          <div className="summary-stats">
            <div className="summary-item">
              <span className="summary-label">Total Operations:</span>
              <span className="summary-value">{formatNumber(stats.total.operations)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Success Rate:</span>
              <span className="summary-value">
                {stats.total.operations > 0 
                  ? ((stats.total.successful / stats.total.operations) * 100).toFixed(1) + '%'
                  : '0%'
                }
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg Processing Time:</span>
              <span className="summary-value">{formatTime(stats.total.avg_processing_time)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Data Processed:</span>
              <span className="summary-value">{formatBytes(stats.total.data_processed)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 