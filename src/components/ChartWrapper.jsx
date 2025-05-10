// src/components/ChartWrapper.jsx

import React from "react";

const ChartWrapper = ({ children }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "80vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflowX: "auto",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ChartWrapper;