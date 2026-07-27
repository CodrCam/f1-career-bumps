import { lazy, Suspense } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useParams,
} from 'react-router-dom';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Seo from './components/Seo.jsx';
import { LoadingFrame } from './ui/LoadingFrame';

const SeasonDesk = lazy(() => import('./pages/SeasonDesk'));
const RaceArchive = lazy(() => import('./pages/RaceArchive'));
const RaceDossier = lazy(() => import('./pages/RaceDossier'));
const SeasonResults = lazy(() => import('./pages/SeasonResults'));
const DriverDirectory = lazy(() => import('./pages/DriverDirectory'));
const DriverProfile = lazy(() => import('./pages/DriverProfile'));
const CompareWorkspace = lazy(() => import('./pages/CompareWorkspace'));
const PaceLab = lazy(() => import('./pages/PaceLab'));
const PitLaneWorkspace = lazy(() => import('./pages/PitLaneWorkspace'));
const AskWorkspace = lazy(() => import('./pages/AskWorkspace'));
const Methodology = lazy(() => import('./pages/Methodology'));
const DriverStandings = lazy(() => (
  import('./pages/ChampionshipStandings').then((module) => ({ default: module.DriverStandings }))
));
const ConstructorStandings = lazy(() => (
  import('./pages/ChampionshipStandings').then((module) => ({ default: module.ConstructorStandings }))
));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const LegacyCoreRedirect = ({ destination }: { destination: string }) => {
  const { seasonYear } = useParams();
  return <Navigate to={`/${seasonYear ?? 2026}/${destination}`} replace />;
};

const App = () => (
  <ErrorBoundary>
    <Router>
      <Seo />
      <AppShell>
        <Suspense fallback={<LoadingFrame label="Loading analysis workspace" />}>
          <Routes>
            <Route path="/" element={<SeasonDesk />} />
            <Route path="/ask" element={<AskWorkspace />} />
            <Route path="/:seasonYear" element={<SeasonDesk />} />
            <Route path="/:seasonYear/races" element={<RaceArchive />} />
            <Route path="/:seasonYear/races/:round" element={<RaceDossier />} />
            <Route path="/:seasonYear/standings/drivers" element={<DriverStandings />} />
            <Route path="/:seasonYear/standings/constructors" element={<ConstructorStandings />} />
            <Route path="/:seasonYear/results" element={<SeasonResults />} />
            <Route path="/:seasonYear/drivers" element={<DriverDirectory />} />
            <Route path="/:seasonYear/drivers/:driverId" element={<DriverProfile />} />
            <Route path="/:seasonYear/compare" element={<CompareWorkspace />} />
            <Route path="/:seasonYear/pace" element={<PaceLab />} />
            <Route path="/:seasonYear/pit-lane" element={<PitLaneWorkspace />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/:seasonYear/constructors" element={<LegacyCoreRedirect destination="standings/constructors" />} />
            <Route path="/:seasonYear/driver-results" element={<LegacyCoreRedirect destination="results" />} />
            <Route path="/:seasonYear/driver-stats" element={<LegacyCoreRedirect destination="drivers" />} />
            <Route path="/:seasonYear/head-to-head" element={<LegacyCoreRedirect destination="compare" />} />
            <Route path="/:seasonYear/sector-analysis" element={<LegacyCoreRedirect destination="pace" />} />
            <Route path="/:seasonYear/pit-strategy" element={<LegacyCoreRedirect destination="pit-lane" />} />
            <Route path="/:seasonYear/pit-stop-analysis" element={<LegacyCoreRedirect destination="pit-lane" />} />
            <Route path="/:seasonYear/race-story" element={<LegacyCoreRedirect destination="races" />} />
            <Route path="/2025-constructors" element={<Navigate to="/2025/standings/constructors" replace />} />
            <Route path="/2025-drivers" element={<Navigate to="/2025/standings/drivers" replace />} />
            <Route path="/driver-results" element={<Navigate to="/2026/results" replace />} />
            <Route path="/driver-stats" element={<Navigate to="/2026/drivers" replace />} />
            <Route path="/head-to-head" element={<Navigate to="/2026/compare" replace />} />
            <Route path="/about" element={<Navigate to="/methodology" replace />} />
            <Route path="/sector-analysis" element={<Navigate to="/2026/pace" replace />} />
            <Route path="/pit-strategy" element={<Navigate to="/2026/pit-lane" replace />} />
            <Route path="/pit-stop-analysis" element={<Navigate to="/2026/pit-lane" replace />} />
            <Route path="/race-story" element={<Navigate to="/2026/races" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>
    </Router>
  </ErrorBoundary>
);

export default App;
