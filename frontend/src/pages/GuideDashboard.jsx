import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import AttendanceTab from "./AttendanceTab.jsx";
import ReportDownload from "../components/ReportDownload.jsx";
import CustomToast from "../components/CustomToast.jsx";

const localISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const GuideDashboard = ({ user }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("projects");
  const [batchUsers, setBatchUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricFrom, setMetricFrom] = useState(() => localISODate(new Date(Date.now() - 30 * 86400000)));
  const [metricTo, setMetricTo] = useState(() => localISODate());
  const [timeEdits, setTimeEdits] = useState({});

  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementDesc, setRequirementDesc] = useState("");
  const [requirementPriority, setRequirementPriority] = useState("medium");
  const [requirementDeadline, setRequirementDeadline] = useState("");
  const [requirementTimeMinutes, setRequirementTimeMinutes] = useState(5);
  const [reqFilter, setReqFilter] = useState("all");
  const [studentTasksModal, setStudentTasksModal] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ show: true, message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast((t) => ({ ...t, show: false }));
  }, []);

  const fetchGuideProjects = async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/projects/guide/projects");
      setProjects(res.data || []);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to fetch projects", "error");
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLeaves = async () => {
    try {
      const res = await api.get("/leave/guide/batch");
      setLeaveRequests(res.data || []);
    } catch {
      /* optional */
    }
  };

  const fetchBatchUsers = async () => {
    try {
      const res = await api.get("/users/guide/batch-users");
      setBatchUsers(res.data?.users || []);
    } catch {
      setBatchUsers([]);
    }
  };

  const fetchMetrics = async () => {
    setMetricsLoading(true);
    try {
      const res = await api.get("/reports/guide/metrics", {
        params: { from: metricFrom, to: metricTo },
      });
      setMetrics(res.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Could not load metrics", "error");
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuideProjects();
    fetchLeaves();
    fetchBatchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "reports") {
      fetchMetrics();
    }
  }, [activeTab, metricFrom, metricTo]);

  const approveProject = async (projectId) => {
    try {
      await api.put(`/projects/${projectId}/approve-batch`);
      showToast("Project approved for your batch.", "success");
      fetchGuideProjects();
    } catch (err) {
      showToast(err.response?.data?.message || "Approve failed", "error");
    }
  };

  const forceMemberStatus = async (projectId, userId, status) => {
    try {
      await api.put(`/projects/${projectId}/guide/member-status`, { userId, status });
      showToast("Student status updated.", "success");
      fetchGuideProjects();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update status", "error");
    }
  };

  const sliceTime = (s) => (s && String(s).length >= 5 ? String(s).slice(0, 5) : String(s || ""));

  const saveWorkTimes = async (projectId) => {
    const p = projects.find((x) => x._id === projectId);
    const edit = timeEdits[projectId] || {};
    const start = sliceTime(edit.start ?? p?.workStartTime ?? "");
    const end = sliceTime(edit.end ?? p?.workEndTime ?? "");
    try {
      await api.patch(`/projects/${projectId}/guide-meta`, {
        workStartTime: start,
        workEndTime: end,
        deadline: null,
      });
      showToast("Work time requirement saved.", "success");
      fetchGuideProjects();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not save times", "error");
    }
  };

  const handleLeaveAction = async (leaveId, status) => {
    try {
      await api.put(`/leave/${leaveId}`, { status });
      showToast(`Leave ${status}.`, "success");
      fetchLeaves();
    } catch (err) {
      showToast(err.response?.data?.message || "Leave update failed", "error");
    }
  };

  const openRequirementModal = (projectId) => {
    setCurrentProjectId(projectId);
    setRequirementTitle("");
    setRequirementDesc("");
    setRequirementPriority("medium");
    setRequirementDeadline("");
    setRequirementTimeMinutes(5);
    setShowRequirementModal(true);
  };

  const openStudentTasks = async (projectId, projectTitle, studentId, studentName) => {
    setStudentTasksModal({
      projectTitle,
      studentName,
      studentId,
      projectId,
      loading: true,
      rows: [],
    });
    try {
      const res = await api.get(`/requirements/student/${studentId}`, { params: { projectId } });
      setStudentTasksModal({
        projectTitle,
        studentName,
        studentId,
        projectId,
        loading: false,
        rows: res.data || [],
      });
    } catch (err) {
      showToast(err.response?.data?.message || "Could not load student tasks", "error");
      setStudentTasksModal(null);
    }
  };

  const submitRequirement = async () => {
    if (!requirementTitle.trim()) {
      showToast("Requirement title is required.", "error");
      return;
    }
    if (!requirementDeadline) {
      showToast("Deadline is required.", "error");
      return;
    }
    
    if (requirementTimeMinutes <= 0) {
      showToast("Time limit must be at least 1 minute.", "error");
      return;
    }

    try {
      await api.post(`/projects/${currentProjectId}/requirements`, {
        title: requirementTitle.trim(),
        description: requirementDesc.trim(),
        priority: requirementPriority,
        deadline: requirementDeadline,
        timeLimitMinutes: requirementTimeMinutes,
      });
      showToast("Requirement added successfully!", "success");
      setShowRequirementModal(false);
      fetchGuideProjects();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add requirement", "error");
    }
  };

  if (loading && activeTab === "projects") {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <CustomToast show={toast.show} message={toast.message} type={toast.type} onClose={closeToast} />

      {studentTasksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Student tasks</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {studentTasksModal.studentName} · {studentTasksModal.projectTitle}
                </p>
              </div>
              <button type="button" onClick={() => setStudentTasksModal(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            {studentTasksModal.loading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {(studentTasksModal.rows || []).map((row, idx) => {
                  const r = row.requirement || {};
                  const st = r.status || "pending";
                  return (
                    <li key={idx} className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                      <div className="font-medium text-gray-900 dark:text-white">{r.title || "Requirement"}</div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Status: <span className="capitalize">{st}</span>
                        {r.completedAt && (
                          <span className="ml-2">
                            · Done {new Date(r.completedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
                {(!studentTasksModal.rows || studentTasksModal.rows.length === 0) && (
                  <li className="text-center text-gray-500">No requirement rows returned.</li>
                )}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setStudentTasksModal(null)}
              className="mt-4 w-full rounded-xl bg-purple-600 py-2 text-white hover:bg-purple-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showRequirementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Requirement</h3>
              <button type="button" onClick={() => setShowRequirementModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <input type="text" value={requirementTitle} onChange={(e) => setRequirementTitle(e.target.value)} placeholder="Title" className="w-full rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              <textarea value={requirementDesc} onChange={(e) => setRequirementDesc(e.target.value)} placeholder="Description" rows={3} className="w-full rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              
              <select value={requirementPriority} onChange={(e) => setRequirementPriority(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              
              <div>
                <label className="text-sm text-gray-600">📅 Deadline Date</label>
                <input type="date" value={requirementDeadline} onChange={(e) => setRequirementDeadline(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">⏰ Time limit (minutes)</label>
                <input
                  type="number"
                  value={requirementTimeMinutes}
                  onChange={(e) => setRequirementTimeMinutes(Math.min(10080, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  min="1"
                  max="10080"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Students must wait this many minutes after Start before they can submit.</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={submitRequirement} className="flex-1 rounded-xl bg-purple-600 py-2 font-semibold text-white hover:bg-purple-700">Save</button>
              <button type="button" onClick={() => setShowRequirementModal(false)} className="flex-1 rounded-xl border border-gray-300 py-2 dark:border-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: "attendance", label: "📅 Attendance" },
          { id: "projects", label: "📋 Projects" },
          { id: "leaves", label: `🌿 Leave Requests (${leaveRequests.filter((l) => l.status === "pending").length})` },
          { id: "reports", label: "📊 Reports" },
        ].map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium transition-all ${activeTab === tab.id ? "border-b-2 border-purple-600 text-purple-600" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "attendance" && (
        <div className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
          <AttendanceTab user={user} isGuide={true} />
        </div>
      )}

      {activeTab === "projects" && (
        <div className="mb-6 rounded-xl bg-white p-5 shadow dark:bg-gray-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Batch projects</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Batch: <strong className="text-purple-600">{user?.assignedBatch || "—"}</strong></p>
            </div>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => fetchGuideProjects({ silent: true })}
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {projects.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No projects for your batch yet.</p>
          ) : (
            <div className="space-y-4">
              {projects.map((p) => {
                const approvedForMyBatch = (p.approvedBatches || []).includes(user?.assignedBatch);
                const requirementsList = p.requirements || [];
                const completionsOf = (req) => req.studentCompletions || [];
                const doneForFilter = (req) => completionsOf(req).length > 0;
                const filteredReqs = requirementsList.filter((req) => {
                  if (reqFilter === "completed") return doneForFilter(req);
                  if (reqFilter === "pending") return !doneForFilter(req);
                  return true;
                });
                const completedWithSubmissions = requirementsList.filter((r) => doneForFilter(r)).length;

                const formatTimeLimitGuide = (req) => {
                  const m = Number(req.timeLimitMinutes) || 0;
                  if (m > 0) return `${m} min`;
                  const h = req.timeLimitHours || 0;
                  const min = req.timeLimitMinutes || 0;
                  const s = req.timeLimitSeconds || 0;
                  if (h === 0 && min === 0 && s === 0) return "No time limit";
                  const parts = [];
                  if (h > 0) parts.push(`${h}h`);
                  if (min > 0) parts.push(`${min}m`);
                  if (s > 0) parts.push(`${s}s`);
                  return parts.join(" ") || "—";
                };

                return (
                  <div key={p._id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{p.title}</div>
                        <div className="text-xs text-gray-500">Targets: {(p.targetBatches || []).join(", ") || "—"}</div>
                        {p.description && <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{p.description}</div>}
                      </div>
                      <button type="button" onClick={() => openRequirementModal(p._id)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700">+ Requirement</button>
                    </div>

                    <div className="mt-3 p-3 bg-gray-50 rounded-lg dark:bg-gray-800/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">📋 Requirements</div>
                        <div className="flex gap-1">
                          {["all", "completed", "pending"].map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setReqFilter(f)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                reqFilter === f ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {requirementsList.length === 0 ? (
                          <p className="text-xs text-gray-500">No requirements added yet.</p>
                        ) : filteredReqs.length === 0 ? (
                          <p className="text-xs text-gray-500">No requirements match this filter.</p>
                        ) : (
                          filteredReqs.map((req) => {
                            const subs = completionsOf(req);
                            const hasSubs = subs.length > 0;
                            return (
                              <div key={req._id || req.title} className="border-b border-gray-200 pb-2 text-xs dark:border-gray-600">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-gray-900 dark:text-white">{req.title}</span>
                                    <div className="text-gray-500">
                                      ⏰ Deadline: {req.deadline ? new Date(req.deadline).toLocaleDateString() : "—"} | ⌛ {formatTimeLimitGuide(req)}
                                    </div>
                                    {hasSubs && (
                                      <ul className="mt-1 list-inside list-disc text-green-700 dark:text-green-400">
                                        {subs.map((c, i) => (
                                          <li key={i}>
                                            {c.student?.name || "Student"}{" "}
                                            <span className="text-gray-500">
                                              ({c.completedAt ? new Date(c.completedAt).toLocaleString() : ""})
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      hasSubs ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                    }`}
                                  >
                                    {hasSubs ? "Completed" : "Awaiting"}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        Submissions: {completedWithSubmissions}/{requirementsList.length} requirements have at least one student completion
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                      <div>
                        <label className="text-xs text-gray-500">Work from</label>
                        <input type="time" value={timeEdits[p._id]?.start !== undefined ? timeEdits[p._id].start : sliceTime(p.workStartTime)} onChange={(e) => setTimeEdits((prev) => ({ ...prev, [p._id]: { ...prev[p._id], start: e.target.value } }))} className="mt-1 block rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Submit after</label>
                        <input type="time" value={timeEdits[p._id]?.end !== undefined ? timeEdits[p._id].end : sliceTime(p.workEndTime)} onChange={(e) => setTimeEdits((prev) => ({ ...prev, [p._id]: { ...prev[p._id], end: e.target.value } }))} className="mt-1 block rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                      </div>
                      <button type="button" onClick={() => saveWorkTimes(p._id)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900">Save times</button>
                      <button type="button" onClick={() => approveProject(p._id)} disabled={approvedForMyBatch} className={`rounded-lg px-4 py-2 text-sm font-medium ${approvedForMyBatch ? "cursor-default bg-green-100 text-green-700" : "bg-purple-600 text-white hover:bg-purple-700"}`}>
                        {approvedForMyBatch ? "Approved" : "Approve"}
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">Student progress</div>
                      <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-gray-600 dark:text-gray-400">
                        {(p.memberStatuses || []).map((m) => {
                          const uid = m.user?._id || m.user;
                          const userCompletedCount = m.completedRequirements?.length || 0;
                          return (
                            <li key={`${p._id}-${uid}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-1 dark:border-gray-700">
                              <span>{m.user?.name || String(uid)}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openStudentTasks(p._id, p.title, uid, m.user?.name || "Student")}
                                  className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                                >
                                  View tasks
                                </button>
                                <span className="capitalize">{m.status}</span>
                                <span className="text-xs text-gray-400">({userCompletedCount}/{requirementsList.length})</span>
                                <select className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] dark:border-gray-600 dark:bg-gray-900 dark:text-white" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ""; if (!v || !uid) return; forceMemberStatus(p._id, uid, v); }}>
                                  <option value="">Override</option>
                                  <option value="pending">Not started</option>
                                  <option value="in-progress">In progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="blocked">Blocked</option>
                                </select>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "leaves" && (
        <div className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
          <h3 className="mb-4 font-semibold">Leave requests</h3>
          {leaveRequests.length === 0 ? <p className="py-8 text-center text-gray-500">No leave requests.</p> : (
            <div className="space-y-3">
              {leaveRequests.map((leave) => (
                <div key={leave._id} className="rounded-lg border p-4 dark:border-gray-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{leave.user?.name}</p><p className="text-sm text-gray-500">{leave.user?.email}</p><p className="mt-1 text-sm">Date: {leave.dateKey}</p><p className="text-sm">Reason: {leave.reason}</p></div>
                    {leave.status === "pending" ? (
                      <div className="flex gap-2"><button onClick={() => handleLeaveAction(leave._id, "approved")} className="rounded-lg bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700">Approve</button><button onClick={() => handleLeaveAction(leave._id, "rejected")} className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700">Reject</button></div>
                    ) : <span className="text-sm capitalize text-gray-600">{leave.status}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "reports" && (
        <div className="space-y-6 rounded-xl bg-white p-5 shadow dark:bg-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Student metrics</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <input type="date" value={metricFrom} onChange={(e) => setMetricFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              <input type="date" value={metricTo} onChange={(e) => setMetricTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
              <button onClick={fetchMetrics} className="rounded-lg bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600">Refresh</button>
            </div>
          </div>
          {metricsLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            </div>
          ) : metrics?.students?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left dark:border-gray-700">
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">Attendance %</th>
                    <th className="py-2 pr-4">Projects</th>
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">In progress</th>
                    <th className="py-2 pr-4">Avg rate</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.students.map((s) => (
                    <tr key={s.userId} className="border-b dark:border-gray-700">
                      <td className="py-2 pr-4 font-medium">{s.name}</td>
                      <td className="py-2 pr-4">{s.attendancePct}%</td>
                      <td className="py-2 pr-4">{s.totalProjectsTracked}</td>
                      <td className="py-2 pr-4">{s.projectsCompleted}</td>
                      <td className="py-2 pr-4">{s.projectsInProgress}</td>
                      <td className="py-2 pr-4">{s.avgCompletionRatePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No metrics for this range.</p>
          )}
          <div>
            <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Downloads</h3>
            <ReportDownload batchUsers={batchUsers} onToast={showToast} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GuideDashboard;