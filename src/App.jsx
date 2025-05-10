// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import ConstructorBump2025Page from "./pages/ConstructorBump2025Page";
import DriverResults2025Page from "./pages/DriverResults2025Page";
import DriverStatsPage from "./pages/DriverStatsPage";
import DriverWDC2025Page from "./pages/DriverWDC2025Page";

const App = () => {
  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/2025-constructors" element={<ConstructorBump2025Page />} />
        <Route path="/2025-drivers" element={<DriverWDC2025Page />} />
        <Route path="/driver-results" element={<DriverResults2025Page />} />
        <Route path="/driver-stats" element={<DriverStatsPage />} />
      </Routes>
    </Router>
  );
};

export default App;