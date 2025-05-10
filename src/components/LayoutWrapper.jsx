import React from "react";

const LayoutWrapper = ({ children }) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#1c1c1e", // Slightly off-black for modern contrast
        color: "#fff",
        padding: 0,
        margin: 0,
      }}
    >
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1475px",
          padding: "2rem 1.5rem",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
};

export default LayoutWrapper;