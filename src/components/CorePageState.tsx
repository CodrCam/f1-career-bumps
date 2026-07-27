interface CorePageStateProps {
  year: number;
  message?: string;
  onRetry: () => void;
}

export const CorePageState = ({
  year,
  message,
  onRetry,
}: CorePageStateProps) => (
  <main className="core-page core-page--error">
    <span className="core-page__eyebrow">Season {year} / data service</span>
    <h1>This publication view could not load.</h1>
    <p>{message ?? 'The data service did not return a usable response.'}</p>
    <button type="button" onClick={onRetry}>Try again</button>
  </main>
);
