import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import AttendanceTab from "./AttendanceTab.jsx";
import OverviewCards from "../components/Admin/OverviewCards.jsx";
import GuideTable from "../components/Admin/GuideTable.jsx";
import StudentTable from "../components/Admin/StudentTable.jsx";
import ProjectTable from "../components/Admin/ProjectTable.jsx";
import BatchManager from "../components/Admin/BatchManager.jsx";
import TopPerformers from "../components/Admin/TopPerformers.jsx";

const AdminDashboard = () => {
  const [tab, setTab] = useState("overview");
  const [mainView, setMainView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState(null);
  const [guides, setGuides] = useState([]);
  const [students, setStudents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [topPerformers, setTopPerformers] = useState({ topGuides: [], topStudents: [] });

  const [projFilters, setProjFilters] = useState({ guide: "", batch: "", adminApproval: "" });

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    assignedBatch: "",
    accountType: "guide",
  });
  const [created, setCreated] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, guidesRes, studentsRes, batchesRes, topRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/guides"),
        api.get("/admin/students"),
        api.get("/admin/batches"),
        api.get("/admin/top-performers"),
      ]);
      setStats(statsRes.data);
      setGuides(guidesRes.data || []);
      setStudents(studentsRes.data?.students || []);
      setBatches(batchesRes.data || []);
      setTopPerformers(topRes.data || { topGuides: [], topStudents: [] });
      await fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = async () => {
    try {
      const params = {};
      if (projFilters.guide) params.guide = projFilters.guide;
      if (projFilters.batch) params.batch = projFilters.batch;
      if (projFilters.adminApproval) params.adminApproval = projFilters.adminApproval;
      const res = await api.get("/admin/projects", { params });
      setProjects(res.data || []);
    } catch {
      setProjects([]);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (tab === "projects") fetchProjects();
  }, [tab, projFilters]);

  const handleKick = async (userId) => {
    if (!window.confirm("Deactivate this user? They will not be able to log in.")) return;
    try {
      await api.put(`/admin/kick-user/${userId}`);
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Kick failed");
    }
  };

  const handleRestore = async (userId) => {
    try {
      await api.put(`/admin/restore-user/${userId}`);
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Restore failed");
    }
  };

  const handleReassign = async (studentId, guideId) => {
    try {
      await api.put(`/admin/students/${studentId}/reassign`, { guideId });
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Reassign failed");
    }
  };

  const handleSaveGuideBatch = async (guideId, assignedBatch) => {
    try {
      await api.put(`/admin/guides/${guideId}`, { assignedBatch });
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Update failed");
    }
  };

  const handleProjectApproval = async (projectId, status) => {
    try {
      await api.put(`/admin/projects/${projectId}/approval`, { status });
      await fetchProjects();
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Update failed");
    }
  };

  const handleCreateBatch = async (name) => {
    try {
      await api.post("/admin/batches", { name });
      const res = await api.get("/admin/batches");
      setBatches(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create batch");
    }
  };

  const handleDeleteBatch = async (id) => {
    if (!window.confirm("Delete this batch?")) return;
    try {
      await api.delete(`/admin/batches/${id}`);
      const res = await api.get("/admin/batches");
      setBatches(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    }
  };

  const handleAssignGuideToBatch = async (batchId, guideId) => {
    try {
      await api.put(`/admin/batches/${batchId}/assign-guide`, { guideId });
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Assign failed");
    }
  };

  const handleCreateGuide = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setError("");
    setCreated(null);
    try {
      const res = await api.post("/auth/admin/create-guide", {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        assignedBatch: form.assignedBatch || undefined,
        accountType: form.accountType,
      });
      setCreated(res.data);
      setForm({ name: "", email: "", password: "", assignedBatch: "", accountType: "guide" });
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create guide");
    } finally {
      setCreateLoading(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "guides", label: "Guides" },
    { id: "students", label: "Students" },
    { id: "projects", label: "Projects" },
    { id: "batches", label: "Batches" },
    { id: "top", label: "Top performers" },
    { id: "create", label: "Create guide" },
  ];

  if (mainView === "attendance") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All attendance</h1>
          <button
            type="button"
            onClick={() => setMainView("dashboard")}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium shadow hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            ← Back
          </button>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-lg dark:border-gray-700 dark:bg-gray-800/90">
          <AttendanceTab isAdmin />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="mt-2 opacity-90">Overview, users, projects, and batches.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => fetchDashboard()}
              className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/30 disabled:opacity-60"
            >
              {loading ? "Loading…" : "Refresh all"}
            </button>
            <button
              type="button"
              onClick={() => setMainView("attendance")}
              className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/30"
            >
              📅 All attendance
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-100/90 p-3 text-sm text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && tab === "overview" && !stats ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-6">
              <OverviewCards stats={stats} />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use the tabs above for detailed management. Refresh pulls latest counts and metrics.
              </p>
            </div>
          )}

          {tab === "guides" && (
            <GuideTable guides={guides} onKick={handleKick} onSaveBatch={handleSaveGuideBatch} />
          )}

          {tab === "students" && (
            <StudentTable
              students={students}
              guides={guides}
              onKick={handleKick}
              onRestore={handleRestore}
              onReassign={handleReassign}
            />
          )}

          {tab === "projects" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <select
                  value={projFilters.guide}
                  onChange={(e) => setProjFilters((f) => ({ ...f, guide: e.target.value }))}
                  className="rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
                  <option value="">All guides</option>
                  {guides.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Batch filter"
                  value={projFilters.batch}
                  onChange={(e) => setProjFilters((f) => ({ ...f, batch: e.target.value }))}
                  className="rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                />
                <select
                  value={projFilters.adminApproval}
                  onChange={(e) => setProjFilters((f) => ({ ...f, adminApproval: e.target.value }))}
                  className="rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
                  <option value="">All admin statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <ProjectTable projects={projects} onApproval={handleProjectApproval} />
            </div>
          )}

          {tab === "batches" && (
            <BatchManager
              batches={batches}
              guides={guides}
              onCreate={handleCreateBatch}
              onDelete={handleDeleteBatch}
              onAssignGuide={handleAssignGuideToBatch}
            />
          )}

          {tab === "top" && (
            <TopPerformers
              topGuides={topPerformers.topGuides}
              topStudents={topPerformers.topStudents}
            />
          )}

          {tab === "create" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800/80">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create guide / leader</h2>
                <form onSubmit={handleCreateGuide} className="mt-4 space-y-3">
                  <select
                    name="accountType"
                    value={form.accountType}
                    onChange={(e) => setForm((p) => ({ ...p, accountType: e.target.value }))}
                    className="w-full rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-900"
                  >
                    <option value="guide">Guide</option>
                    <option value="leader">Leader</option>
                  </select>
                  <input
                    required
                    name="name"
                    placeholder="Name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <input
                    required
                    name="email"
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <input
                    name="password"
                    placeholder="Password (optional)"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <input
                    name="assignedBatch"
                    placeholder="Assigned batch"
                    value={form.assignedBatch}
                    onChange={(e) => setForm((p) => ({ ...p, assignedBatch: e.target.value }))}
                    className="w-full rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="w-full rounded-xl bg-purple-600 py-2 font-semibold text-white disabled:opacity-60"
                  >
                    {createLoading ? "Creating…" : "Create"}
                  </button>
                </form>
                {created && (
                  <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-900/30">
                    Created {created.user?.email}
                    {created.generatedPassword && (
                      <div className="font-mono">Password: {created.generatedPassword}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
