import React from "react";
import { getTeamColor } from "./dataProcessing.js";

export const createResponsiveChartOptions = (isMobile, title, chartType = 'line') => {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: true,  // Changed from false to true - only show tooltip for the hovered point
      mode: 'point',    // Changed from 'index' to 'point' - only show single point data
    },
    plugins: {
      title: {
        display: true,
        text: title,
        font: { 
          size: isMobile ? 14 : 18 
        },
        padding: {
          bottom: isMobile ? 10 : 20
        }
      },
      legend: {
        position: isMobile ? 'bottom' : 'right',
        align: isMobile ? 'center' : 'start',
        labels: {
          boxWidth: 12,
          padding: isMobile ? 6 : 8,
          font: {
            size: isMobile ? 10 : 12
          },
          // Limit legend items on mobile
          filter: isMobile ? function(legendItem, chartData) {
            return legendItem.datasetIndex < 10;
          } : undefined
        },
      },
      tooltip: {
        enabled: true,
        // Custom tooltip callbacks based on chart type
        callbacks: {
          title: function(context) {
            // Show the race/round name
            return context[0].label;
          },
          label: function (context) {
            const driver = context.dataset.label;
            const value = context.raw;
            
            if (chartType === 'constructor') {
              return `${driver}: P${value}`;
            } else if (chartType === 'driver') {
              return `${driver}: ${value} pts`;
            } else if (chartType === 'results') {
              return `${driver}: P${value}`;
            }
            
            return `${driver}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: !isMobile,
          text: "Circuit",
          font: {
            size: isMobile ? 10 : 12
          }
        },
        ticks: {
          maxRotation: isMobile ? 45 : 0,
          font: {
            size: isMobile ? 9 : 11
          }
        },
        grid: {
          display: !isMobile
        }
      },
      y: {
        title: {
          display: !isMobile,
          text: chartType === 'constructor' ? "Position" : "Points",
          font: {
            size: isMobile ? 10 : 12
          }
        },
        ticks: {
          font: {
            size: isMobile ? 9 : 11
          },
          callback: function(val) {
            return chartType === 'constructor' || chartType === 'results' ? `P${val}` : val;
          }
        },
        grid: {
          display: !isMobile
        }
      },
    },
    elements: {
      line: {
        tension: 0.2,
        borderWidth: isMobile ? 1 : 2,
      },
      point: {
        radius: isMobile ? 2 : 3,      // Slightly larger for easier hovering
        hoverRadius: isMobile ? 4 : 6,  // Larger hover radius for better UX
      },
    },
    animation: {
      duration: isMobile ? 500 : 1000,
    },
  };

  // Add reverse scale for constructor charts
  if (chartType === 'constructor') {
    baseOptions.scales.y.reverse = true;
    baseOptions.scales.y.min = 1;
    baseOptions.scales.y.max = 10;
  } else if (chartType === 'results') {
    baseOptions.scales.y.reverse = true;
    baseOptions.scales.y.min = 1;
    baseOptions.scales.y.max = 20;
  } else {
    baseOptions.scales.y.beginAtZero = true;
  }

  return baseOptions;
};

export const createMobileDriverSelector = (drivers, selectedDrivers, setSelectedDrivers) => {
  const isMobile = window.innerWidth < 768;
  
  if (isMobile) {
    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: "0.5rem", 
        marginBottom: "1rem",
        padding: "0 1rem"
      }}>
        {[0, 1].map((i) => (
          <select
            key={i}
            value={selectedDrivers[i]}
            onChange={(e) => {
              const copy = [...selectedDrivers];
              copy[i] = e.target.value;
              setSelectedDrivers(copy);
            }}
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
            {drivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ))}
        <button 
          onClick={() => setSelectedDrivers(["", ""])}
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
  }
  
  // Desktop version
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      gap: "1rem", 
      marginBottom: "1.5rem" 
    }}>
      {[0, 1].map((i) => (
        <select
          key={i}
          value={selectedDrivers[i]}
          onChange={(e) => {
            const copy = [...selectedDrivers];
            copy[i] = e.target.value;
            setSelectedDrivers(copy);
          }}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "1px solid #555",
            backgroundColor: "#333",
            color: "#fff"
          }}
        >
          <option value="">Select Driver {i + 1}</option>
          {drivers.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      ))}
      <button 
        onClick={() => setSelectedDrivers(["", ""])}
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
        Reset
      </button>
    </div>
  );
};