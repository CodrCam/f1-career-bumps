interface LoadingFrameProps {
  label?: string;
}

export const LoadingFrame = ({ label = 'Loading season desk' }: LoadingFrameProps) => (
  <main className="slip-loading-frame" aria-busy="true" aria-live="polite">
    <span className="slip-loading-frame__eyebrow">Season desk</span>
    <span className="slip-loading-frame__line is-wide" />
    <span className="slip-loading-frame__line" />
    <div className="slip-loading-frame__grid" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    <span className="sr-only">{label}</span>
  </main>
);
