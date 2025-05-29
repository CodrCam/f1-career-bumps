// src/components/UIControls.jsx
import React from 'react';

// Session selector for API-dependent pages
export const SessionSelector = ({ 
  sessions = [],
  selectedSession,
  onSessionChange,
  onLoadData,
  loading = false,
  label = "Select Session",
  buttonText = "Load Data"
}) => {
  return (
    <div className="analysis-controls">
      <div className="controls-grid">
        <div className="controls-row">
          <select 
            value={selectedSession} 
            onChange={(e) => onSessionChange(e.target.value)}
            className="analysis-select"
            style={{
              padding: "0.75rem",
              fontSize: "1rem",
              borderRadius: "6px",
              border: "1px solid #555",
              backgroundColor: "#333",
              color: "#fff",
              minWidth: "200px"
            }}
          >
            <option value="">{label}</option>
            {sessions.map(session => (
              <option key={session.session_key} value={session.session_key}>
                {session.location} - {session.session_name} ({session.date_start?.split('T')[0] || 'TBD'})
              </option>
            ))}
          </select>
          <button 
            onClick={onLoadData}
            disabled={loading || !selectedSession}
            className="analysis-button"
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: loading || !selectedSession ? "#666" : "#007bff",
              color: "#fff",
              cursor: loading || !selectedSession ? "not-allowed" : "pointer",
              opacity: loading || !selectedSession ? 0.6 : 1
            }}
          >
            {loading ? 'Loading...' : buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Driver toggle buttons for analysis pages
export const DriverToggleButtons = ({ 
  drivers = [],
  selectedDrivers = new Set(),
  onToggleDriver,
  maxDrivers = 6,
  driverColors = {},
  title = "Select Drivers to Compare"
}) => {
  return (
    <div className="driver-selection">
      <h3>{title} (max {maxDrivers}):</h3>
      <div className="driver-buttons" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        {drivers.map(driverNum => {
          const isSelected = selectedDrivers.has(driverNum);
          return (
            <button
              key={driverNum}
              onClick={() => onToggleDriver(driverNum)}
              className={`driver-button ${isSelected ? 'active' : ''} ${selectedDrivers.size >= maxDrivers && !isSelected ? 'disabled' : ''}`}
              style={{
                padding: '0.5rem',
                border: '2px solid #555',
                borderRadius: '6px',
                backgroundColor: isSelected ? (driverColors[driverNum] || '#6366f1') : '#333',
                borderColor: isSelected ? (driverColors[driverNum] || '#6366f1') : '#555',
                color: '#fff',
                cursor: selectedDrivers.size >= maxDrivers && !isSelected ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                opacity: selectedDrivers.size >= maxDrivers && !isSelected ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
              disabled={selectedDrivers.size >= maxDrivers && !isSelected}
            >
              {driverNum}
            </button>
          );
        })}
      </div>
      {selectedDrivers.size === 0 && (
        <p style={{ 
          color: '#9ca3af', 
          fontSize: '0.875rem', 
          marginTop: '0.5rem',
          textAlign: 'center'
        }}>
          No drivers selected - showing all drivers
        </p>
      )}
    </div>
  );
};

// Mobile-friendly dropdown selectors
export const MobileDriverSelectors = ({ 
  drivers = [],
  selectedDrivers = ["", ""],
  onDriverChange,
  maxDrivers = 2
}) => {
  return (
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
          onChange={(e) => onDriverChange(i, e.target.value)}
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
        onClick={() => onDriverChange('reset')}
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
  );
};

// Desktop driver selectors (dropdowns)
export const DesktopDriverSelectors = ({ 
  drivers = [],
  selectedDrivers = ["", ""],
  onDriverChange,
  maxDrivers = 2
}) => {
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      gap: "1rem", 
      marginBottom: "1.5rem",
      flexWrap: "wrap"
    }}>
      {Array.from({ length: maxDrivers }, (_, i) => (
        <select
          key={i}
          value={selectedDrivers[i] || ''}
          onChange={(e) => onDriverChange(i, e.target.value)}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff",
            minWidth: "150px"
          }}
        >
          <option value="">Select Driver {i + 1}</option>
          {drivers.map((driver) => (
            <option key={driver} value={driver}>{driver}</option>
          ))}
        </select>
      ))}
      <button 
        onClick={() => onDriverChange('reset')}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          borderRadius: "6px",
          border: "1px solid #666",
          backgroundColor: "#555",
          color: "#fff",
          cursor: "pointer"
        }}
      >
        Reset
      </button>
    </div>
  );
};

// Responsive driver selector that switches between mobile/desktop
export const ResponsiveDriverSelector = ({ 
  drivers = [],
  selectedDrivers = ["", ""],
  onDriverChange,
  maxDrivers = 2,
  isMobile = false
}) => {
  if (isMobile) {
    return (
      <MobileDriverSelectors
        drivers={drivers}
        selectedDrivers={selectedDrivers}
        onDriverChange={onDriverChange}
        maxDrivers={maxDrivers}
      />
    );
  }

  return (
    <DesktopDriverSelectors
      drivers={drivers}
      selectedDrivers={selectedDrivers}
      onDriverChange={onDriverChange}
      maxDrivers={maxDrivers}
    />
  );
};

// Compact control bar for pages with multiple controls
export const ControlBar = ({ children, className = '' }) => {
  return (
    <div className={`control-bar ${className}`} style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '1rem',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      marginBottom: '1.5rem'
    }}>
      {children}
    </div>
  );
};

// Toggle switch for settings
export const ToggleSwitch = ({ 
  checked, 
  onChange, 
  label, 
  disabled = false 
}) => {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <div style={{
        width: '40px',
        height: '20px',
        backgroundColor: checked ? '#007bff' : '#555',
        borderRadius: '10px',
        position: 'relative',
        transition: 'background-color 0.2s ease'
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          backgroundColor: 'white',
          borderRadius: '50%',
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          transition: 'left 0.2s ease'
        }} />
      </div>
      {label && <span style={{ color: '#fff', fontSize: '0.9rem' }}>{label}</span>}
    </label>
  );
};