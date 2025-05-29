// src/components/LoadingStates.jsx
import React from 'react';

// Simple spinner component
export const LoadingSpinner = ({ size = 'medium', color = '#007bff' }) => {
  const sizeMap = {
    small: '20px',
    medium: '40px',
    large: '60px'
  };

  return (
    <div
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: `3px solid rgba(255, 255, 255, 0.1)`,
        borderTop: `3px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}
    />
  );
};

// Chart loading skeleton
export const ChartLoadingSkeleton = ({ isMobile = false }) => {
  return (
    <div style={{
      padding: isMobile ? '1rem' : '2rem',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      margin: '1rem 0'
    }}>
      {/* Title skeleton */}
      <div style={{
        height: '24px',
        backgroundColor: '#333',
        borderRadius: '4px',
        marginBottom: '1.5rem',
        width: '60%',
        margin: '0 auto 1.5rem auto',
        animation: 'pulse 2s infinite'
      }} />
      
      {/* Chart area skeleton */}
      <div style={{
        height: isMobile ? '300px' : '400px',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        padding: '2rem'
      }}>
        {/* Simulate chart bars/lines */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            style={{
              width: isMobile ? '20px' : '30px',
              height: `${Math.random() * 80 + 20}%`,
              backgroundColor: '#444',
              borderRadius: '2px',
              animation: `pulse 2s infinite ${i * 0.2}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Data loading component with message
export const DataLoader = ({ 
  message = 'Loading F1 data...', 
  submessage = null,
  showSpinner = true 
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 1rem',
      textAlign: 'center',
      color: '#fff'
    }}>
      {showSpinner && (
        <LoadingSpinner size="large" color="#FF8700" />
      )}
      <h3 style={{ 
        marginTop: showSpinner ? '1.5rem' : '0',
        marginBottom: '0.5rem',
        color: '#fff',
        fontSize: '1.2rem'
      }}>
        {message}
      </h3>
      {submessage && (
        <p style={{ 
          color: '#ccc', 
          fontSize: '0.9rem',
          maxWidth: '400px'
        }}>
          {submessage}
        </p>
      )}
    </div>
  );
};

// Table loading skeleton
export const TableLoadingSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      overflow: 'hidden',
      margin: '1rem 0'
    }}>
      {/* Header skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '1rem',
        padding: '1rem',
        backgroundColor: '#333',
        borderBottom: '1px solid #555'
      }}>
        {[...Array(columns)].map((_, i) => (
          <div
            key={i}
            style={{
              height: '20px',
              backgroundColor: '#555',
              borderRadius: '4px',
              animation: 'pulse 2s infinite'
            }}
          />
        ))}
      </div>
      
      {/* Row skeletons */}
      {[...Array(rows)].map((_, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: '1rem',
            padding: '1rem',
            borderBottom: rowIndex < rows - 1 ? '1px solid #333' : 'none'
          }}
        >
          {[...Array(columns)].map((_, colIndex) => (
            <div
              key={colIndex}
              style={{
                height: '16px',
                backgroundColor: '#444',
                borderRadius: '4px',
                animation: `pulse 2s infinite ${(rowIndex + colIndex) * 0.1}s`
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// Error message component
export const ErrorMessage = ({ 
  title = 'Error Loading Data',
  message = 'Something went wrong while loading the F1 data.',
  onRetry = null,
  type = 'error' // 'error', 'warning', 'info'
}) => {
  const colors = {
    error: { bg: '#dc354520', border: '#dc3545', icon: '❌' },
    warning: { bg: '#ffc10720', border: '#ffc107', icon: '⚠️' },
    info: { bg: '#17a2b820', border: '#17a2b8', icon: 'ℹ️' }
  };

  const style = colors[type];

  return (
    <div style={{
      backgroundColor: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: '8px',
      padding: '1.5rem',
      margin: '1rem 0',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
        {style.icon}
      </div>
      <h3 style={{ 
        color: style.border, 
        marginBottom: '0.5rem',
        fontSize: '1.1rem'
      }}>
        {title}
      </h3>
      <p style={{ 
        color: '#ccc', 
        marginBottom: onRetry ? '1rem' : '0',
        lineHeight: '1.4'
      }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: style.border,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
};

// CSS animation styles (add this to your main CSS file)
export const loadingStyles = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;