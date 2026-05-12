import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import UserAttendance from "./UserAttendance.jsx";
import ProjectCard from "../components/ProjectCard.jsx";
import CustomToast from "../components/CustomToast.jsx";

const UserDashboard = ({ user }) => {
  const [projects, setProjects] = useState([]);
  const [projectDetails, setProjectDetails] = useState({});
  const [profileCard, setProfileCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [startingProject, setStartingProject] = useState(null);
  const [completedTasksList, setCompletedTasksList] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [activeTab, setActiveTab] = useState("attendance");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ dateKey: new Date().toISOString().split('T')[0], reason: "" });
  const [myLeaveRequests, setMyLeaveRequests] = useState([]);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState(null);

  const myUserId = String(user?.id || user?._id || "");

  const formatCountdown = (startedAt, timeLimitMinutes) => {
    if (!startedAt) return null;
    const limit = Number(timeLimitMinutes) || 0;
    if (limit <= 0) return "✅ Ready to submit!";
    const endMs = new Date(startedAt).getTime() + limit * 60 * 1000;
    const leftMs = endMs - Date.now();
    if (leftMs <= 0) return "✅ Ready to submit!";
    const totalSec = Math.max(1, Math.ceil(leftMs / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `Time remaining: ${m}:${String(s).padStart(2, "0")}`;
  };

  const canSubmitRequirement = (req) => {
    if (req.status === "locked" || req.lockedByOther) return false;
    if (req.status === "completed") return false;
    if (req.status !== "in-progress") return false;
    const limit = Number(req.timeLimitMinutes) || 0;
    if (limit <= 0) return true;
    if (!req.startedAt) return false;
    const elapsed = Date.now() - new Date(req.startedAt).getTime();
    return elapsed >= limit * 60 * 1000;
  };

  const formatTimeLimit = (req) => {
    const m = Number(req.timeLimitMinutes) || 0;
    if (m <= 0) return "No time limit";
    return `${m} minute${m === 1 ? "" : "s"}`;
  };

  const showToast = useCallback((message, type = "success") => {
    setToast({ show: true, message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast((t) => ({ ...t, show: false }));
  }, []);

  const fetchMyLeaves = async () => {
    try {
      const res = await api.get("/leave/mine");
      setMyLeaveRequests(res.data || []);
    } catch (err) {
      console.error("Failed to fetch leaves:", err);
    }
  };

  const applyLeave = async () => {
    if (!leaveForm.dateKey) { showToast("⚠️ Please select a date", "error"); return; }
    if (!leaveForm.reason.trim()) { showToast("⚠️ Please provide a reason", "error"); return; }
    try {
      await api.post("/leave", { dateKey: leaveForm.dateKey, reason: leaveForm.reason.trim() });
      showToast("✅ Leave request submitted successfully!", "success");
      setShowLeaveModal(false);
      setLeaveForm({ dateKey: new Date().toISOString().split('T')[0], reason: "" });
      await fetchMyLeaves();
    } catch (err) {
      showToast(err.response?.data?.message || "❌ Failed to submit leave request", "error");
    }
  };

  const fetchData = async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) {
      setLoading(true);
      setError("");
    } else {
      setRefreshing(true);
    }
    try {
      const projectsRes = await api.get("/projects");
      setProjects(projectsRes.data || []);
      const profileRes = await api.get("/users/me/profile-card");
      setProfileCard(profileRes.data);
      const tasksRes = await api.get("/tasks");
      const mine = (tasksRes.data || []).filter(
        (t) => String(t.assignedTo?._id || t.assignedTo) === myUserId
      );
      setCompletedTasksList(mine.filter((t) => t.status === "completed"));
      const detailsEntries = await Promise.all((projectsRes.data || []).map(async (p) => {
        try {
          const detailRes = await api.get(`/projects/member-view/${p._id}`);
          return [p._id, detailRes.data];
        } catch { return [p._id, { tasks: [], requirements: [], guide: null, myProjectStatus: "pending" }]; }
      }));
      setProjectDetails(Object.fromEntries(detailsEntries));
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || "Failed to load dashboard");
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMyLeaves();
  }, []);

  const openStartModal = (project) => { setSelectedProject(project); setShowStartModal(true); };
  
  const startProject = async () => {
    if (!selectedProject) return;
    setShowStartModal(false);
    setStartingProject(selectedProject._id);
    try {
      const response = await api.post(`/projects/${selectedProject._id}/start`);
      if (response.data.success) { showToast(`✅ Project "${selectedProject.title}" started!`, "success"); await fetchData(); }
      else { showToast(response.data.message || "Project started!", "success"); await fetchData(); }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to start project";
      showToast(errorMsg, "error");
    } finally { setStartingProject(null); setSelectedProject(null); }
  };

  const openRequirementsModal = async (projectId) => {
    try {
      const res = await api.get(`/projects/member-view/${projectId}`);
      setSelectedProjectDetails(res.data);
      setShowRequirementsModal(true);
    } catch {
      const details = projectDetails[projectId];
      setSelectedProjectDetails(details);
      setShowRequirementsModal(true);
    }
  };

  const refreshRequirementsModal = async () => {
    const pid = selectedProjectDetails?._id;
    if (!pid) return;
    try {
      const updatedDetails = await api.get(`/projects/member-view/${pid}`);
      setSelectedProjectDetails(updatedDetails.data);
    } catch {
      showToast("Could not refresh requirements", "error");
    }
  };

  const markProjectComplete = async (project) => {
    try {
      await api.put(`/projects/${project._id}/member-status`, { status: "completed" });
      showToast("🎉 Project marked complete!", "success");
      await fetchData();
    } catch (err) { showToast(err.response?.data?.message || "Could not update status.", "error"); }
  };

  const startRequirement = async (projectId, requirement) => {
    try {
      const response = await api.post(`/requirements/${requirement._id}/start`);
      if (response.data.success) {
        showToast(`🚀 Started working on: ${requirement.title}`, "success");
        await fetchData({ silent: true });
        if (selectedProjectDetails && selectedProjectDetails._id === projectId) {
          const updatedDetails = await api.get(`/projects/member-view/${projectId}`);
          setSelectedProjectDetails(updatedDetails.data);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to start requirement", "error");
    }
  };

  const completeRequirement = async (projectId, requirement) => {
    try {
      const response = await api.post(`/requirements/${requirement._id}/complete`);
      if (response.data.success) {
        showToast(`✅ Completed: ${requirement.title}`, "success");
        await fetchData({ silent: true });
        if (selectedProjectDetails && selectedProjectDetails._id === projectId) {
          const updatedDetails = await api.get(`/projects/member-view/${projectId}`);
          setSelectedProjectDetails(updatedDetails.data);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Cannot complete yet. Wait for the time limit.", "error");
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      <CustomToast show={toast.show} message={toast.message} type={toast.type} onClose={closeToast} />

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">🌿 Apply for Leave</h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <input 
                type="date" 
                value={leaveForm.dateKey} 
                onChange={(e) => setLeaveForm({ ...leaveForm, dateKey: e.target.value })} 
                className="w-full rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <textarea 
                value={leaveForm.reason} 
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} 
                rows={3} 
                placeholder="Reason for leave..." 
                className="w-full rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={applyLeave} className="flex-1 rounded-xl bg-purple-600 py-2 text-white hover:bg-purple-700">Submit</button>
              <button onClick={() => setShowLeaveModal(false)} className="flex-1 rounded-xl border py-2 dark:border-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Start Project Modal */}
      {showStartModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Start Project?</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to start "<strong className="text-purple-600">{selectedProject.title}</strong>"?
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={startProject} className="flex-1 rounded-xl bg-purple-600 py-2 text-white hover:bg-purple-700">Yes, Start</button>
              <button onClick={() => setShowStartModal(false)} className="flex-1 rounded-xl border py-2 dark:border-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Requirements Modal */}
      {showRequirementsModal && selectedProjectDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">📋 Project Requirements</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshRequirementsModal()}
                  className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Refresh
                </button>
                <button type="button" onClick={() => setShowRequirementsModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="space-y-3">
              {selectedProjectDetails.requirements?.length === 0 ? (
                <p className="text-center text-gray-500">No requirements added yet.</p>
              ) : (
                selectedProjectDetails.requirements?.map((req) => {
                  const isLocked = req.status === "locked" || req.lockedByOther;
                  const isCompleted = req.status === "completed";
                  const isStarted = req.status === "in-progress";
                  const canSubmit = canSubmitRequirement(req);
                  const timeRemaining = formatCountdown(req.startedAt, req.timeLimitMinutes);

                  return (
                    <div key={req._id} className={`rounded-xl border p-4 ${isCompleted ? "border-green-200 bg-green-50/50" : isLocked ? "border-amber-200 bg-amber-50/40" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{req.title}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              req.priority === "high" ? "bg-red-100 text-red-700" :
                              req.priority === "medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-green-100 text-green-700"
                            }`}>
                              {req.priority || "medium"}
                            </span>
                            {isCompleted && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                ✅ Completed
                              </span>
                            )}
                            {isLocked && !isCompleted && (
                              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                🔒 Taken by another student
                              </span>
                            )}
                            {isStarted && !isCompleted && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                ⏳ In Progress
                              </span>
                            )}
                          </div>
                          {req.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{req.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                            <span>⏰ Deadline: {new Date(req.deadline).toLocaleDateString()}</span>
                            <span>⌛ Time limit: {formatTimeLimit(req)}</span>
                          </div>
                          {isLocked && req.startedByName && (
                            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Started by: {req.startedByName}</p>
                          )}
                          {isStarted && !isCompleted && timeRemaining && (
                            <div className="mt-2 text-sm text-orange-600 dark:text-orange-400 font-mono">
                              {timeRemaining}
                            </div>
                          )}
                        </div>
                        <div className="ml-3 shrink-0">
                          {!isCompleted && !isStarted && !isLocked && (
                            <button
                              type="button"
                              onClick={() => startRequirement(selectedProjectDetails._id, req)}
                              className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
                            >
                              Start
                            </button>
                          )}

                          {!isCompleted && isStarted && canSubmit && (
                            <button
                              type="button"
                              onClick={() => completeRequirement(selectedProjectDetails._id, req)}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                            >
                              Submit
                            </button>
                          )}

                          {!isCompleted && isStarted && !canSubmit && (
                            <div className="text-right text-xs text-gray-500">
                              <span className="block">⏳ Waiting for time limit</span>
                            </div>
                          )}

                          {isCompleted && (
                            <span className="text-xs text-green-600 font-medium px-3 py-1.5">
                              ✅ Done
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-6">
              <button type="button" onClick={() => setShowRequirementsModal(false)} className="w-full rounded-xl bg-purple-600 py-2 text-white hover:bg-purple-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Header */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium opacity-90">{getGreeting()}</p>
            <h1 className="text-3xl font-bold">
              Welcome back, {user?.name?.split(" ")[0] || "User"}! 👋
            </h1>
            <p className="mt-1 text-sm opacity-90">
              Track your progress and manage your projects
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLeaveModal(true)}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/30"
            >
              🌿 Apply for Leave
            </button>
            <button
              type="button"
              disabled={refreshing}
              onClick={async () => {
                await fetchData({ silent: true });
                await fetchMyLeaves();
              }}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/30 disabled:opacity-60"
            >
              <svg className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-100/90 p-3 text-sm text-rose-800 backdrop-blur-sm dark:bg-rose-900/40 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "attendance"
              ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          📅 My Attendance
        </button>
        <button
          onClick={() => setActiveTab("projects")}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "projects"
              ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          📁 Available Projects
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "tasks"
              ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          ✅ Completed Tasks
          {completedTasksList.length > 0 && (
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              {completedTasksList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("leaves")}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "leaves"
              ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          🌿 My Leaves
          {myLeaveRequests.filter(l => l.status === "pending").length > 0 && (
            <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              {myLeaveRequests.filter(l => l.status === "pending").length}
            </span>
          )}
        </button>
      </div>

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
            <UserAttendance />
          </div>

          {profileCard && (
            <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">📊 Your Performance</h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl bg-purple-50 p-4 text-center dark:bg-purple-900/20">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{profileCard.profile?.batch || "-"}</div>
                  <div className="text-xs text-gray-500">Batch</div>
                </div>
                <div className="rounded-xl bg-green-50 p-4 text-center dark:bg-green-900/20">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedTasksList.length}</div>
                  <div className="text-xs text-gray-500">Tasks Done</div>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 text-center dark:bg-blue-900/20">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{profileCard.metrics?.attendancePct || 0}%</div>
                  <div className="text-xs text-gray-500">Attendance</div>
                </div>
                <div className="rounded-xl bg-yellow-50 p-4 text-center dark:bg-yellow-900/20">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{profileCard.metrics?.completedProjects || 0}</div>
                  <div className="text-xs text-gray-500">Projects Done</div>
                </div>
                <div className="rounded-xl bg-indigo-50 p-4 text-center dark:bg-indigo-900/20">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{profileCard.profile?.stars || 0}⭐</div>
                  <div className="text-xs text-gray-500">Stars</div>
                </div>
                <div className="rounded-xl bg-pink-50 p-4 text-center dark:bg-pink-900/20">
                  <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{profileCard.metrics?.avgCompletionTimeDays || 0}</div>
                  <div className="text-xs text-gray-500">Avg Days</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">📁 Available Projects</h3>
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white/80 p-12 text-center shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
              <p className="text-gray-600 dark:text-gray-400">No projects available yet.</p>
            </div>
          ) : (
            projects.map((project) => {
              const requirementsCount = projectDetails[project._id]?.requirements?.length || 0;
              const details = projectDetails[project._id];
              return (
                <div key={project._id} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${
                      project.difficulty === "hard" ? "bg-red-100 text-red-700" : 
                      project.difficulty === "moderate" ? "bg-yellow-100 text-yellow-700" : 
                      "bg-green-100 text-green-700"
                    }`}>
                      {project.difficulty || "basic"}
                    </span>
                    <button 
                      onClick={() => openRequirementsModal(project._id)} 
                      className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      Requirements ({requirementsCount})
                    </button>
                  </div>
                  <ProjectCard 
                    mode="student" 
                    project={project} 
                    details={details} 
                    userRole="member" 
                    busy={startingProject === project._id} 
                    onStartProject={(p) => openStartModal(p)} 
                    onMarkComplete={markProjectComplete} 
                  />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div>
          <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">✅ Completed Tasks</h3>
          {completedTasksList.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white/80 p-12 text-center shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
              <p className="text-gray-600 dark:text-gray-400">No completed tasks yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedTasksList.map((task) => (
                <div key={task._id} className="rounded-xl border border-green-200 bg-green-50/50 p-4 dark:border-green-900/30 dark:bg-green-900/20">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{task.title}</h4>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{task.description}</p>
                  <div className="mt-2 flex justify-between">
                    <span className="text-xs text-green-600 dark:text-green-400">✓ Completed</span>
                    <span className="text-xs text-gray-500">
                      {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : "Recently"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leaves Tab */}
      {activeTab === "leaves" && (
        <div>
          <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">📋 My Leave Requests</h3>
          {myLeaveRequests.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white/80 p-12 text-center shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
              <p className="text-gray-600 dark:text-gray-400">No leave requests submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myLeaveRequests.map((leave) => (
                <div key={leave._id} className="rounded-xl border border-gray-200 bg-white/80 p-4 shadow-md backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        📅 Date: {new Date(leave.dateKey).toLocaleDateString()}
                      </p>
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">📝 Reason: {leave.reason}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      leave.status === "approved" 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                        : leave.status === "rejected" 
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}>
                      {leave.status === "approved" ? "✅ Approved" : leave.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;