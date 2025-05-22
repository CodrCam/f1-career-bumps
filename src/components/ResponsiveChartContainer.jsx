import React, { useEffect, useState } from "react";

const ResponsiveChartContainer = ({ children, title }) => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < 768
  });

  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setDimensions({
        width: newWidth,
        height: window.innerHeight,
        isMobile: newWidth < 768
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chartHeight = dimensions.isMobile ? 
    Math.min(400, dimensions.height - 200) : // Mobile: smaller, fixed height
    Math.min(600, dimensions.height * 0.7);   // Desktop: responsive height

  return (
    <div style={{ 
      padding: dimensions.isMobile ? "1rem" : "2rem",
      width: "100%",
      boxSizing: "border-box"
    }}>
      {title && (
        <h1 style={{ 
          textAlign: "center", 
          fontSize: dimensions.isMobile ? "1.5rem" : "2rem",
          marginBottom: "1rem",
          wordWrap: "break-word"
        }}>
          {title}
        </h1>
      )}
      
      <div style={{
        height: `${chartHeight}px`,
        width: "100%",
        position: "relative",
        overflowX: dimensions.isMobile ? "auto" : "visible"
      }}>
        {children}
      </div>
    </div>
  );
};

export default ResponsiveChartContainer;