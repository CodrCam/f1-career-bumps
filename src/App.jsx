import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/Navbar";
import Home from "./pages/Home";
import ConstructorBump2025Page from "./pages/ConstructorBump2025Page";
import DriverResults2025Page from "./pages/DriverResults2025Page";
import DriverStatsPage from "./pages/DriverStatsPage";
import DriverWDC2025Page from "./pages/DriverWDC2025Page";
import DriverHeadToHeadPage from "./pages/DriverHeadToHeadPage";
import About from "./pages/About";

// New F1 Analysis Pages
import SectorAnalysisPage from "./pages/SectorAnalysisPage";
import PitStrategyPage from "./pages/PitStrategyPage";
import PitStopAnalysisPage from "./pages/PitStopAnalysisPage";
import RaceStoryPage from "./pages/RaceStoryPage";

// Import Error Boundary
import ErrorBoundary from "./components/ErrorBoundary";

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:seasonYear/constructors" element={<ConstructorBump2025Page />} />
          <Route path="/:seasonYear/drivers" element={<DriverWDC2025Page />} />
          <Route path="/:seasonYear/driver-results" element={<DriverResults2025Page />} />
          <Route path="/:seasonYear/driver-stats" element={<DriverStatsPage />} />
          <Route path="/:seasonYear/head-to-head" element={<DriverHeadToHeadPage />} />
          <Route path="/:seasonYear/sector-analysis" element={<SectorAnalysisPage />} />
          <Route path="/:seasonYear/pit-strategy" element={<PitStrategyPage />} />
          <Route path="/:seasonYear/pit-stop-analysis" element={<PitStopAnalysisPage />} />
          <Route path="/2026/race-story" element={<RaceStoryPage />} />
          <Route path="/2025-constructors" element={<Navigate to="/2025/constructors" replace />} />
          <Route path="/2025-drivers" element={<Navigate to="/2025/drivers" replace />} />
          <Route path="/driver-results" element={<Navigate to="/2026/driver-results" replace />} />
          <Route path="/driver-stats" element={<Navigate to="/2026/driver-stats" replace />} />
          <Route path="/head-to-head" element={<Navigate to="/2026/head-to-head" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/sector-analysis" element={<Navigate to="/2026/sector-analysis" replace />} />
          <Route path="/pit-strategy" element={<Navigate to="/2026/pit-strategy" replace />} />
          <Route path="/pit-stop-analysis" element={<Navigate to="/2026/pit-stop-analysis" replace />} />
          <Route path="/race-story" element={<Navigate to="/2026/race-story" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
