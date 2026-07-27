import type { CSSProperties } from 'react';
import { FlagTriangleRight } from 'lucide-react';
import TeamCarMark from '../components/TeamCarMark.jsx';
import { getCircuitLengthMeters } from '../data/circuitLengths.js';
import type { PaceDriver } from '../data/paceData';
import { getTeamKeyByName } from '../data/seasonGrid.js';
import {
  formatEquivalentGapMeters,
  getEquivalentGapMeters,
  getPaceGapFormation,
} from '../utils/paceGapFormation.js';

type PaceMetric = 'lap' | 'sector1' | 'sector2' | 'sector3';
type LapTreatment = 'best' | 'average';

interface FormationDriver extends PaceDriver {
  value: number;
  gap: number;
  displayRank: number;
}

interface PaceGapFormationProps {
  drivers: FormationDriver[];
  location?: string;
  meetingName?: string;
  metric: PaceMetric;
  sessionName?: string;
  treatment: LapTreatment;
  year: number;
}

const metricLabel = (metric: PaceMetric) => (
  metric === 'lap' ? 'lap' : `sector ${metric.at(-1)}`
);

const formationTitle = (sessionName = '') => {
  if (/qualifying/i.test(sessionName)) return 'Qualifying gap formation';
  if (/sprint/i.test(sessionName)) return 'Sprint pace formation';
  return 'Front-running pace formation';
};

export const PaceGapFormation = ({
  drivers,
  location,
  meetingName,
  metric,
  sessionName,
  treatment,
  year,
}: PaceGapFormationProps) => {
  const formation = getPaceGapFormation(drivers, { metric, treatment }) as FormationDriver[];
  if (formation.length < 2) return null;

  const maximumGap = Math.max(0.001, formation.at(-1)?.gap ?? 0);
  const leaderLapTime = metric === 'lap' ? formation[0]?.value : null;
  const circuitLengthMeters = metric === 'lap' ? getCircuitLengthMeters(location) : null;
  const equivalentDistance = (gapSeconds: number) => getEquivalentGapMeters({
    gapSeconds,
    lapTimeSeconds: leaderLapTime,
    circuitLengthMeters,
  });
  const maximumEquivalentDistance = equivalentDistance(maximumGap);
  const accessibleSummary = formation.map((driver) => (
    `${driver.acronym} P${driver.displayRank} ${
      driver.gap === 0 ? 'fastest' : `plus ${driver.gap.toFixed(3)} seconds`
    }${
      equivalentDistance(driver.gap) === null
        ? ''
        : `, ${formatEquivalentGapMeters(equivalentDistance(driver.gap))} lap-time equivalent from the leader`
    }`
  )).join(', ');

  return (
    <section className="analysis-panel pace-gap-formation">
      <header className="analysis-panel__header">
        <div>
          <span className="core-page__eyebrow">The gap, seen from above</span>
          <h2>{formationTitle(sessionName)}</h2>
        </div>
        <span>
          <FlagTriangleRight aria-hidden="true" size={17} />
          Top {formation.length}
        </span>
      </header>

      <p className="analysis-summary">
        {meetingName} · {treatment} {metricLabel(metric)}. The nearest contenders stay in frame;
        the view stops after a meaningful break in the order.
      </p>

      <div
        aria-label={`${formationTitle(sessionName)}. ${accessibleSummary}.`}
        className="pace-gap-formation__stage"
        role="img"
      >
        <div className="pace-gap-formation__finish" aria-hidden="true">
          <span>0.000</span>
        </div>
        <ol>
          {formation.map((driver) => {
            const teamKey = getTeamKeyByName(driver.team);
            const offset = (driver.gap / maximumGap) * 62;
            const distance = equivalentDistance(driver.gap);
            const style = {
              '--formation-color': driver.color,
              '--formation-offset': `${offset}%`,
              '--formation-mobile-offset': `${offset * 0.82}%`,
            } as CSSProperties;

            return (
              <li key={driver.driverNumber} style={style}>
                <span className="pace-gap-formation__identity">
                  <strong>P{driver.displayRank}</strong>
                  <span>{driver.acronym}</span>
                  <small>{driver.gap === 0 ? 'FASTEST' : `+${driver.gap.toFixed(3)}`}</small>
                  {distance !== null && (
                    <em>{formatEquivalentGapMeters(distance)} eq.</em>
                  )}
                </span>
                <span className="pace-gap-formation__lane" aria-hidden="true">
                  <span className="pace-gap-formation__car">
                    {teamKey ? (
                      <TeamCarMark
                        compact
                        decorative
                        number={driver.driverNumber}
                        team={teamKey}
                        year={year}
                      />
                    ) : (
                      <span className="pace-gap-formation__fallback-car" />
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <footer className="pace-gap-formation__note">
        {maximumEquivalentDistance !== null ? (
          <>
            <span>{(Number(circuitLengthMeters) / 1000).toFixed(3)} km circuit</span>
            <p>
              Equivalent metres = circuit length × time gap ÷ leader lap time.
              This is not simultaneous track position.
            </p>
            <span>{formatEquivalentGapMeters(maximumEquivalentDistance)} eq.</span>
          </>
        ) : (
          <>
            <span>Leader</span>
            <p>
              Spacing is proportional to the selected timing gap and rescaled to this group.
              {metric === 'lap'
                ? ' Circuit length is unavailable, so the view remains time-only.'
                : ' Sector metres are omitted because authoritative sector lengths are unavailable.'}
            </p>
            <span>+{maximumGap.toFixed(3)}s</span>
          </>
        )}
      </footer>
    </section>
  );
};
