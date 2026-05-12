import { useState } from "react";
import api from "../services/api";

const localISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function ReportDownload({ batchUsers = [], onToast }) {
  const [from, setFrom] = useState(() => localISODate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => localISODate());
  const [studentId, setStudentId] = useState("");
  const [format, setFormat] = useState("xlsx");
  const [busy, setBusy] = useState(false);

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const runDownload = async (path, filenameBase) => {
    if (!from || !to) {
      onToast?.("Choose a date range (from / to).", "error");
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ from, to, format });
      if (studentId) params.set("studentId", studentId);
      const res = await api.get(`${path}?${params.toString()}`, { responseType: "blob" });
      const ext = format === "csv" ? "csv" : "xlsx";
      downloadBlob(res.data, `${filenameBase}.${ext}`);
      onToast?.("Download started.", "success");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Download failed";
      onToast?.(typeof msg === "string" ? msg : "Download failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadIndividual = async () => {
    if (!studentId) {
      onToast?.("Select a student for the individual report.", "error");
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ from, to, format });
      const res = await api.get(`/reports/student/${studentId}?${params.toString()}`, {
        responseType: "blob",
      });
      const ext = format === "csv" ? "csv" : "xlsx";
      downloadBlob(res.data, `student-report-${studentId}.${ext}`);
      onToast?.("Download started.", "success");
    } catch (err) {
      onToast?.("Individual report failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/80 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            From (local)
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            To (local)
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Filter student (optional)
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">Whole batch</option>
            {batchUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Format
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => runDownload("/reports/attendance", `attendance-${from}-${to}`)}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          Attendance report
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => runDownload("/reports/projects", `projects-report`)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Project report
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={downloadIndividual}
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Individual student (all data)
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Dates use your browser&apos;s local calendar day. Exports include only students in your assigned
        batch.
      </p>
    </div>
  );
}
