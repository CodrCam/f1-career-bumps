// src/components/ChartComponents.jsx
import React from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { getTeamColor } from '../utils/dataProcessing.js';

// Generic responsive chart wrapper
export const ResponsiveChart = ({ 
  type = 'line', 
  data, 
  options, 
  className = '',
  style = {},
  loading = false,
  error = null,
  onRetry = null 
}) => {
  const ChartComponent = {
    line: Line,
    bar: Bar,
    scatter: Scatter
  }[type];

  if (loading) {
    return (
      <div className={`chart-loading ${className}`} style={style}>
        <div className="loading-spinner"></div>
        <p>Loading chart...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`chart-error ${className}`} style={style}>
        <p>Error loading chart: {error}</p>
        {onRetry && (
          <button onClick={onRetry} className="retry-button">
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!data || !ChartComponent) {
    return (
      <div className={`chart-placeholder ${className}`} style={style}>
        <p>No chart data available</p>
      </div>
    );
  }

  return (
    <div className={`chart-wrapper ${className} fade-in`} style={style}>
      <ChartComponent data={data} options={options} />
    </div>
  );
};

// F1-specific driver selector component
export const DriverSelector = ({ 
  drivers = [],
  selectedDrivers = [],
  onDriverSelect,
  maxDrivers = 2,
  isMobile = false,
  title = "Select Drivers to Compare"
}) => {
  if (isMobile) {
    // Mobile dropdown version
    return (
      <div className="driver-selector mobile">
        <h3>{title} (max {maxDrivers}):</h3>
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "0.5rem", 
          marginBottom: "1rem",
          padding: "0 1rem"
        }}>
          {Array.from({ length: maxDrivers }, (_, i) => (
            <select
              key={i}
              value={selectedDrivers[i] || ''}
              onChange={(e) => onDriverSelect && onDriverSelect(i, e.target.value)}
              style={{
                padding: "0.75rem",
                fontSize: "1rem",
                borderRadius: "6px",
                border: "1px solid #555",
                backgroundColor: "#333",
                color: "#fff",
                width: "100%"
              }}
            >
              <option value="">Select Driver {i + 1}</option>
              {drivers.map((driver) => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </select>
          ))}
          <button 
            onClick={() => onDriverSelect && onDriverSelect('reset')}
            style={{
              padding: "0.75rem",
              fontSize: "1rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#666",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Reset Selection
          </button>
        </div>
      </div>
    );
  }

  // Desktop button version
  return (
    <div className="driver-selector desktop">
      <h3>{title} (max {maxDrivers}):</h3>
      <div className="driver-buttons" style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '0.5rem', 
        justifyContent: 'center',
        marginBottom: '1rem'
      }}>
        {drivers.map(driver => {
          const isSelected = selectedDrivers.includes(driver);
          return (
            <button
              key={driver}
              onClick={() => onDriverSelect && onDriverSelect('toggle', driver)}
              className={`driver-button ${isSelected ? 'active' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                border: '2px solid #555',
                borderRadius: '6px',
                backgroundColor: isSelected ? getTeamColor(driver) : '#333',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem',
                ...(selectedDrivers.length >= maxDrivers && !isSelected ? { opacity: 0.5, pointerEvents: 'none' } : {})
              }}
              disabled={selectedDrivers.length >= maxDrivers && !isSelected}
            >
              {driver}
            </button>
          );
        })}
      </div>
      {selectedDrivers.length > 0 && (
        <button 
          onClick={() => onDriverSelect && onDriverSelect('reset')}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            borderRadius: "6px",
            border: "1px solid #666",
            backgroundColor: "#555",
            color: "#fff",
            cursor: "pointer",
            marginBottom: "1rem"
          }}
        >
          Reset Selection
        </button>
      )}
    </div>
  );
};

// Statistics display cards
export const StatsGrid = ({ stats = [], className = '' }) => {
  return (
    <div className={`stats-grid ${className}`}>
      {stats.map((stat, index) => (
        <div key={index} className={`stat-card ${stat.color || 'blue'}`}>
          <h3>{stat.label}</h3>
          <div className="stat-value">{stat.value}</div>
          {stat.sublabel && <div className="stat-label">{stat.sublabel}</div>}
        </div>
      ))}
    </div>
  );
};

// F1 Page Layout wrapper for consistent styling
export const F1PageLayout = ({ 
  title,
  subtitle,
  children,
  className = '',
  showHeader = true
}) => {
  return (
    <div className={`f1-page-layout ${className}`}>
      {showHeader && (
        <div className="page-header">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="page-content">
        {children}
      </div>
    </div>
  );
};

// Championship chart specifically for bump charts
export const ChampionshipBumpChart = ({ 
  data, 
  options, 
  type = 'driver', // 'driver' or 'constructor'
  title,
  selectedDrivers = [],
  onDriverSelect,
  allDrivers = [],
  isMobile = false
}) => {
  const chartTitle = title || `${type === 'driver' ? 'Driver' : 'Constructor'} Championship Standings`;
  
  return (
    <F1PageLayout 
      title={chartTitle}
      subtitle="Race-by-race progression throughout the season"
      className={`championship-chart ${type}-championship`}
    >
      {/* Driver selector for driver charts */}
      {type === 'driver' && allDrivers.length > 0 && (
        <DriverSelector
          drivers={allDrivers}
          selectedDrivers={selectedDrivers}
          onDriverSelect={onDriverSelect}
          maxDrivers={2}
          isMobile={isMobile}
          title="Filter Drivers"
        />
      )}

      {/* Chart */}
      <ResponsiveChart 
        type="line" 
        data={data} 
        options={options}
        className="championship-line-chart"
        style={{ height: isMobile ? '400px' : '600px' }}
      />
    </F1PageLayout>
  );
};