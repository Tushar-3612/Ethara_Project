import { useEffect, useMemo, useState } from "react";

const LS_PREFIX = "ethara_project_start_";

const statusLabel = (s) => {
  if (s === "in-progress") return "In Progress";
  if (s === "completed") return "Completed";
  if (s === "blocked") return "Blocked";
  return "Not Started";
};

const formatDuration = (ms) => {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const formatRemaining = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
};

/** @param {{ deadline?: string | Date | null, remainingTime?: string | null, isDeadlinePassed?: boolean }} details */
const countdownText = (details) => {
  if (!details?.deadline) return "No deadline set";
  if (details?.isDeadlinePassed) return "Deadline passed";
  if (details?.remainingTime) return `Time left: ${details.remainingTime}`;
  const end = new Date(details.deadline).getTime();
  return `Time left: ${formatRemaining(end - Date.now())}`;
};

const parseHHmmToMinutes = (s) => {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
};

/** Daily “submit after” time — no calendar date */
const dailyTimeRequirementText = (workEndTime, tick) => {
  if (!workEndTime) return "Guide will set a submit-after time";
  const endMin = parseHHmmToMinutes(workEndTime);
  if (endMin == null) return "Invalid time setting";
  const now = new Date();
  const end = new Date(now);
  end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
  const left = end.getTime() - now.getTime();
  if (left <= 0) return `Past ${workEndTime} today — you can mark complete`;
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return `Until ${workEndTime} today: ${h}h ${m}m ${sec}s`;
};

/**
 * @param {object} props
 * @param {"default"|"student"} [props.mode]
 */
const ProjectCard = ({
  mode = "default",
  project,
  progress = 0,
  onDelete,
  canDelete,
  /** Member-view payload for student mode */
  details,
  onStartProject,
  onMarkComplete,
  onForceComplete,
  userRole = "member",
  busy = false,
}) => {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (mode !== "student") return undefined;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => {
    if (mode !== "student" || !project?._id || !details?.myStartedAt) return;
    try {
      localStorage.setItem(
        `${LS_PREFIX}${project._id}`,
        new Date(details.myStartedAt).toISOString()
      );
    } catch {
      /* ignore */
    }
  }, [mode, project?._id, details?.myStartedAt]);

  const studentTimerMs = useMemo(() => {
    if (mode !== "student" || !details) return 0;
    if (details.myProjectStatus === "completed") return 0;
    let start = details.myStartedAt ? new Date(details.myStartedAt).getTime() : 0;
    if (!start && project?._id) {
      try {
        const raw = localStorage.getItem(`${LS_PREFIX}${project._id}`);
        if (raw) start = new Date(raw).getTime();
      } catch {
        /* ignore */
      }
    }
    if (!start) return 0;
    return tick - start;
  }, [mode, details, tick, project?._id]);

  const studentTimeline = useMemo(() => {
    if (mode !== "student" || !details) return "";
    if (details.deadline) {
      return countdownText(details);
    }
    return dailyTimeRequirementText(details.workEndTime, tick);
  }, [mode, details, tick]);

  const workWindowHint = useMemo(() => {
    if (mode !== "student" || !details) return "";
    const a = details.workStartTime ? String(details.workStartTime).slice(0, 5) : null;
    const b = details.workEndTime ? String(details.workEndTime).slice(0, 5) : null;
    if (a && b) return `Daily window: ${a} – ${b} (local)`;
    if (b) return `Submit after ${b} (local, same every day)`;
    return "";
  }, [mode, details]);

  if (mode === "student") {
    const st = details?.myProjectStatus || "pending";
    const hasStarted = st === "in-progress" || st === "completed" || st === "blocked";
    const isGuide = userRole === "guide";
    const isDeadlinePassed = Boolean(details?.isDeadlinePassed ?? details?.pastDeadline);
    const canComplete = isGuide ? true : Boolean(details?.canMarkComplete && isDeadlinePassed);
    const canForceComplete = isGuide && hasStarted && st !== "completed";

    return (
      <div className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
              {project.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {project.description || "No description provided."}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
            {statusLabel(st)}
          </span>
        </div>

        {workWindowHint && (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{workWindowHint}</p>
        )}

        <div className="mt-4 grid gap-2 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">Time requirement</div>
            <div className="font-mono text-sm">{studentTimeline}</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">Time on project</div>
            <div className="font-mono text-sm">
              {hasStarted && st !== "completed" ? formatDuration(studentTimerMs) : st === "completed" ? "—" : "—"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!hasStarted && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStartProject?.(project)}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
            >
              Start Project
            </button>
          )}
          {hasStarted && st !== "completed" && (
            <button
              type="button"
              disabled={!canComplete || busy}
              title={
                !isGuide && !isDeadlinePassed
                  ? "Complete is available only after the deadline."
                  : "Mark as completed"
              }
              onClick={() => onMarkComplete?.(project)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Mark completed
            </button>
          )}
          {canForceComplete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onForceComplete?.(project)}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Force Complete
            </button>
          )}
        </div>
        {!isDeadlinePassed && st === "in-progress" && !isGuide && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Complete unlocks only after the deadline is reached.
          </p>
        )}
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, progress));
  const members = project.members || [];
  const visibleAvatars = members.slice(0, 3);

  const handleDelete = () => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    onDelete?.(project._id);
  };

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
            {project.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {project.description || "No description provided."}
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-white">
          {members.length} {members.length === 1 ? "member" : "members"}
        </div>
      </div>

      {visibleAvatars.length > 0 && (
        <div className="mt-3 flex items-center">
          {visibleAvatars.map((member, index) => (
            <div
              key={member._id || member}
              className={`-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-purple-600 text-[10px] font-semibold uppercase text-white first:ml-0 dark:border-gray-800 ${
                index > 0 ? "bg-purple-500" : "bg-purple-600"
              }`}
              title={member.name || "Member"}
            >
              {(member.name || "U").slice(0, 1)}
            </div>
          ))}
          {members.length > 3 && (
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">+{members.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Progress</span>
          <span className="font-medium text-gray-700 dark:text-white">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div className="h-full rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
        Created by: <span className="font-medium">{project.createdBy?.name || "Unknown"}</span>
      </div>

      {canDelete && typeof onDelete === "function" && (
        <button
          type="button"
          onClick={handleDelete}
          className="mt-4 w-full rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Delete project
        </button>
      )}
    </div>
  );
};

export default ProjectCard;
