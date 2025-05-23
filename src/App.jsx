import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
// DRSAnalysisPage removed due to data availability issues

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
        <Route path="/head-to-head" element={<DriverHeadToHeadPage />} />
        <Route path="/about" element={<About />} />
        
        {/* New F1 Analysis Routes */}
        <Route path="/sector-analysis" element={<SectorAnalysisPage />} />
        <Route path="/pit-strategy" element={<PitStrategyPage />} />
        {/* DRS Analysis route removed due to OpenF1 API data limitations */}
      </Routes>
    </Router>
  );
};

export default App;