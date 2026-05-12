import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import CustomToast from "../components/CustomToast.jsx";

const localISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatTimeAmPm = (d) =>
  d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });

const parsePunchDisplay = (att) => {
  if (!att?.actualPunchTime && !att?.punchInTime) return null;
  const raw = att.actualPunchTime || att.punchInTime;
  const parts = String(raw).split(":");
  if (parts.length < 2) return raw;
  const h = parseInt(parts[0], 10);
  const min = parts[1];
  const sec = parts[2] || "00";
  const d = new Date();
  d.setHours(h, parseInt(min, 10), parseInt(sec, 10), 0);
  return formatTimeAmPm(d);
};

/** 9:00–9:59:59 local — same rule as backend */
const withinPunchWindow = (d) => {
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= 9 * 60 && mins < 10 * 60;
};

export default function UserAttendance() {
  const [attendance, setAttendance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = useCallback((message, type = "success") => {
    setToast({ show: true, message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast((t) => ({ ...t, show: false }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, histRes] = await Promise.all([
        api.get("/attendance/today"),
        api.get("/attendance/my/history", { params: { days: 14 } }),
      ]);
      setAttendance(todayRes.data);
      setHistory(histRes.data || []);
    } catch {
      showToast("Could not load today’s attendance.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const inWindow = useMemo(() => withinPunchWindow(nowTick), [nowTick]);
  const punched = Boolean(attendance?.punchIn);

  const punchLabel = useMemo(() => {
    if (punched) return parsePunchDisplay(attendance) || "Recorded";
    if (inWindow) return formatTimeAmPm(nowTick);
    return "—";
  }, [attendance, punched, inWindow, nowTick]);

  const handlePunch = async () => {
    try {
      const res = await api.post("/attendance/punch-in");
      setAttendance(res.data);
      showToast("Attendance marked successfully.", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Could not mark attendance.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
      <CustomToast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today&apos;s attendance</h2>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/90">
        You can mark attendance till 10:00 AM only (local time).
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Today (local): <strong>{localISODate(nowTick)}</strong>
      </p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
          <div className="text-xl font-semibold capitalize text-gray-900 dark:text-white">
            {attendance?.status || "absent"}
          </div>
          {punched && (
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Punched in at <span className="font-mono font-medium">{punchLabel}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handlePunch}
          disabled={punched || !inWindow}
          className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {punched ? "Punch-in recorded" : `Punch In — ${punchLabel}`}
        </button>
      </div>

      {!inWindow && !punched && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          The punch-in window is closed for today. Contact your guide if you need a correction.
        </p>
      )}

      <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-600">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Recent attendance</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Last 14 days (local dates)</p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
          <table className="w-full min-w-[320px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Punch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                    No records in this period.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row._id || row.dateKey} className="dark:text-gray-200">
                    <td className="px-3 py-2 font-mono text-xs">{row.dateKey}</td>
                    <td className="px-3 py-2 capitalize">{row.status}</td>
                    <td className="px-3 py-2">
                      {row.actualPunchTime || row.punchInTime
                        ? parsePunchDisplay(row)
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
