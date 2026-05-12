import { useEffect, useState } from "react";
import api from "../services/api";
import CustomToast from "../components/CustomToast.jsx";

const localISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const AttendanceTab = ({ user, isGuide = false, isAdmin = false }) => {
  const [selectedDate, setSelectedDate] = useState(() => localISODate());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ status: "present", reason: "", punchTime: "" });
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToastMessage = (message, type = "success") => {
    setToast({ show: true, message, type });
  };

  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const fetchDay = async (dateKey) => {
    setLoading(true);
    try {
      const path = isAdmin ? `/attendance/admin/day/${dateKey}` : `/attendance/guide/day/${dateKey}`;
      const res = await api.get(path);
      setRows(res.data?.rows || []);
    } catch (err) {
      showToastMessage(err.response?.data?.message || "Failed to load attendance.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isGuide && !isAdmin) return;
    fetchDay(selectedDate);
  }, [selectedDate, isGuide, isAdmin]);

  const saveExisting = async (recordId) => {
    try {
      const payload = { status: editForm.status, reason: editForm.reason };
      if (editForm.punchTime) {
        payload.punchTime = editForm.punchTime;
      }
      await api.put(`/attendance/record/${recordId}`, payload);
      showToastMessage("Attendance updated.", "success");
      setEditingId(null);
      fetchDay(selectedDate);
    } catch (err) {
      showToastMessage(err.response?.data?.message || "Update failed.", "error");
    }
  };

  const saveNew = async (userId) => {
    try {
      const payload = {
        userId,
        dateKey: selectedDate,
        status: editForm.status,
        reason: editForm.reason,
      };
      if (editForm.punchTime) {
        payload.punchTime = editForm.punchTime;
      }
      await api.post(`/attendance/guide/mark`, payload);
      showToastMessage("Attendance saved.", "success");
      setEditingId(null);
      fetchDay(selectedDate);
    } catch (err) {
      showToastMessage(err.response?.data?.message || "Save failed.", "error");
    }
  };

  const formatPunchTime = (timeString) => {
    if (!timeString) return "-";
    const parts = String(timeString).split(":");
    const h = parseInt(parts[0], 10);
    const minutes = parts[1] || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  };

  const goToPreviousDay = () => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() - 1);
    setSelectedDate(localISODate(date));
  };

  const goToNextDay = () => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + 1);
    setSelectedDate(localISODate(date));
  };

  const goToToday = () => setSelectedDate(localISODate());

  const formatDate = (dateString) => {
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, options);
  };

  if (!isGuide && !isAdmin) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Use the Attendance page (sidebar) for your punch-in view.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <CustomToast show={toast.show} message={toast.message} type={toast.type} onClose={closeToast} />

      {(isGuide || isAdmin) && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {isAdmin ? (
            <>Viewing <strong>all students</strong> across every batch.</>
          ) : (
            <>Viewing batch attendance for <strong>{user?.assignedBatch || user?.batch || "your assigned batch"}</strong>.</>
          )}
        </p>
      )}

      <div className="rounded-xl bg-white p-4 shadow dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <button onClick={goToPreviousDay} className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600">
              ← Previous
            </button>
            <button onClick={goToToday} className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700">
              Today
            </button>
            <button onClick={goToNextDay} className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600">
              Next →
            </button>
          </div>
          <div className="text-lg font-semibold">📅 {formatDate(selectedDate)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Batch</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Punch time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Late</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Reason</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Marked by</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">No students found.</td>
                </tr>
              ) : (
                rows.map(({ user: student, attendance: record }) => {
                  const rowKey = record?._id || `new:${student._id}`;
                  const isEdit = editingId === rowKey;
                  const punchSrc = record?.actualPunchTime || record?.punchInTime;

                  return (
                    <tr key={student._id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-sm">{student.batch || "—"}</td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {isEdit ? (
                          <input
                            type="time"
                            value={editForm.punchTime || (punchSrc ? punchSrc.slice(0, 5) : "")}
                            onChange={(e) => setEditForm({ ...editForm, punchTime: e.target.value })}
                            className="rounded-lg border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                          />
                        ) : (
                          formatPunchTime(punchSrc)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEdit ? (
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            className="rounded-lg border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                            <option value="half-day">Half day</option>
                          </select>
                        ) : (
                          <span className="text-sm capitalize">{record?.status || "absent"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{record?.isLate ? `${record.lateMinutes} min` : "—"}</td>
                      <td className="px-4 py-3">
                        {isEdit ? (
                          <input
                            value={editForm.reason}
                            onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                            className="w-40 rounded-lg border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                            placeholder="Note"
                          />
                        ) : (
                          <span className="text-sm">{record?.reason || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{record?.markedByName || "—"}</td>
                      <td className="px-4 py-3">
                        {isEdit ? (
                          <div className="flex gap-2">
                            <button onClick={() => record?._id ? saveExisting(record._id) : saveNew(student._id)} className="text-sm font-medium text-green-600 hover:text-green-700">
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-sm text-gray-600 hover:text-gray-800">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(rowKey);
                              setEditForm({
                                status: record?.status || "present",
                                reason: record?.reason || "",
                                punchTime: record?.punchInTime ? record.punchInTime.slice(0, 5) : "",
                              });
                            }}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            {record ? "Edit" : "Set status"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTab;