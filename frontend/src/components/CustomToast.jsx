import { useEffect } from "react";

/**
 * Fixed toast — pass `onClose` to dismiss early, or it auto-hides after `durationMs`.
 */
export default function CustomToast({ show, message, type = "success", onClose, durationMs = 4000 }) {
  useEffect(() => {
    if (!show || !onClose) return undefined;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [show, onClose, durationMs]);

  if (!show) return null;

  const bg =
    type === "error"
      ? "bg-red-600 text-white"
      : type === "info"
        ? "bg-slate-700 text-white"
        : "bg-emerald-600 text-white";

  return (
    <div
      className={`fixed top-20 right-4 z-[100] max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ${bg}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <span>{message}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs opacity-90 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
