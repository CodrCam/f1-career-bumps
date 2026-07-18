import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import NavBar from "./components/Navbar";
import { getSeasonPath } from "./utils/seasons.js";
import ErrorBoundary from "./components/ErrorBoundary";

const Home = lazy(() => import("./pages/Home.jsx"));
const ConstructorBump2025Page = lazy(() => import("./pages/ConstructorBump2025Page.jsx"));
const DriverResults2025Page = lazy(() => import("./pages/DriverResults2025Page.jsx"));
const DriverStatsPage = lazy(() => import("./pages/DriverStatsPage.jsx"));
const DriverWDC2025Page = lazy(() => import("./pages/DriverWDC2025Page.jsx"));
const DriverHeadToHeadPage = lazy(() => import("./pages/DriverHeadToHeadPage.jsx"));
const SectorAnalysisPage = lazy(() => import("./pages/SectorAnalysisPage.jsx"));
const PitStopAnalysisPage = lazy(() => import("./pages/PitStopAnalysisPage.jsx"));
const RaceStoryPage = lazy(() => import("./pages/RaceStoryPage.jsx"));
const About = lazy(() => import("./pages/About.jsx"));

const LegacyPitStrategyRedirect = () => {
  const { seasonYear } = useParams();
  return <Navigate to={getSeasonPath(seasonYear, "pit-stop-analysis")} replace />;
};

const RouteLoadingFallback = () => (
  <main className="route-loading" aria-busy="true" aria-live="polite">
    <span className="route-loading-spinner" aria-hidden="true" />
    <span>Loading analysis…</span>
  </main>
);

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <NavBar />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:seasonYear/constructors" element={<ConstructorBump2025Page />} />
            <Route path="/:seasonYear/drivers" element={<DriverWDC2025Page />} />
            <Route path="/:seasonYear/driver-results" element={<DriverResults2025Page />} />
            <Route path="/:seasonYear/driver-stats" element={<DriverStatsPage />} />
            <Route path="/:seasonYear/head-to-head" element={<DriverHeadToHeadPage />} />
            <Route path="/:seasonYear/sector-analysis" element={<SectorAnalysisPage />} />
            <Route path="/:seasonYear/pit-strategy" element={<LegacyPitStrategyRedirect />} />
            <Route path="/:seasonYear/pit-stop-analysis" element={<PitStopAnalysisPage />} />
            <Route path="/2026/race-story" element={<RaceStoryPage />} />
            <Route path="/2025-constructors" element={<Navigate to="/2025/constructors" replace />} />
            <Route path="/2025-drivers" element={<Navigate to="/2025/drivers" replace />} />
            <Route path="/driver-results" element={<Navigate to="/2026/driver-results" replace />} />
            <Route path="/driver-stats" element={<Navigate to="/2026/driver-stats" replace />} />
            <Route path="/head-to-head" element={<Navigate to="/2026/head-to-head" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/sector-analysis" element={<Navigate to="/2026/sector-analysis" replace />} />
            <Route path="/pit-strategy" element={<Navigate to="/2026/pit-stop-analysis" replace />} />
            <Route path="/pit-stop-analysis" element={<Navigate to="/2026/pit-stop-analysis" replace />} />
            <Route path="/race-story" element={<Navigate to="/2026/race-story" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
