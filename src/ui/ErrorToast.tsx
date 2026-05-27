import { useEffect } from "react";

type Props = {
  message: string;
  onClose: () => void;
};

/** A brief, dismissable error message (auto-hides after a few seconds). */
export function ErrorToast({ message, onClose }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(id);
  }, [onClose, message]);

  return (
    <div className="toast" role="alert">
      <span className="toast__msg">{message}</span>
      <button type="button" className="toast__close" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
