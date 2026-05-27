type Props = {
  label: string;
  progress: number; // 0..1; 0 shows an indeterminate bar
};

/** Dimmed overlay shown while a PDF is being read and its first pages render. */
export function LoadingOverlay({ label, progress }: Props) {
  return (
    <div className="pdf-loading" role="status" aria-live="polite">
      <div className="pdf-loading__card">
        <div className="pdf-loading__spinner" aria-hidden="true" />
        <p className="pdf-loading__label">Opening {label}…</p>
        <div className="pdf-loading__bar">
          <div
            className={`pdf-loading__fill${progress > 0 ? "" : " pdf-loading__fill--indeterminate"}`}
            style={progress > 0 ? { transform: `scaleX(${progress})` } : undefined}
          />
        </div>
      </div>
    </div>
  );
}
