/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import api from "../services/api";
import ProjectCard from "../components/ProjectCard.jsx";

const Projects = ({ searchQuery = "" }) => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [projects, setProjects] = useState([]);
  const [batchOptions, setBatchOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createBatch, setCreateBatch] = useState("");
  const [createPlatform, setCreatePlatform] = useState("");
  const [createPriority, setCreatePriority] = useState("medium");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, totalTasks: 0 });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await api.get("/projects");
      setProjects(response.data);
      calculateStats(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchOptions = async () => {
    try {
      const response = await api.get("/auth/batches");
      setBatchOptions(response.data?.batches || []);
    } catch (err) {
      console.error("Failed to fetch batches", err);
    }
  };

  const calculateStats = (projectsList) => {
    const total = projectsList.length;
    const active = projectsList.filter(p => p.status !== "completed").length;
    const completed = projectsList.filter(p => p.status === "completed").length;
    const totalTasks = projectsList.reduce((sum, p) => sum + (p.stats?.totalTasks || 0), 0);
    setStats({ total, active, completed, totalTasks });
  };

  const createProject = async (event) => {
    event.preventDefault();
    if (!createTitle.trim()) {
      setError("Project title is required");
      return;
    }
    try {
      await api.post("/projects", {
        title: createTitle,
        description: createDescription,
        targetBatches: createBatch ? [createBatch] : [],
        platform: createPlatform,
        priority: createPriority,
      });
      setCreateTitle("");
      setCreateDescription("");
      setCreateBatch("");
      setCreatePlatform("");
      setCreatePriority("medium");
      fetchProjects();
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create project");
    }
  };

  const deleteProject = async (projectId) => {
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      calculateStats(projects.filter((p) => p._id !== projectId));
      setShowDeleteConfirm(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete project");
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchBatchOptions();
  }, []);

  // Stat Card Component
  const StatCard = ({ title, value, color, icon }) => (
    <div className="group rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800/80">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </div>
          <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
        </div>
        <div className={`rounded-full ${color.replace("text", "bg").replace("font-bold", "")} bg-opacity-10 p-3 transition-all group-hover:scale-110`}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  const visibleProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      {/* Header with gradient */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="mt-1 text-sm opacity-90">
              Track progress across your team projects
            </p>
          </div>
          <button
            onClick={fetchProjects}
            className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/30"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Projects" 
          value={stats.total} 
          color="text-purple-600 dark:text-purple-400"
          icon={
            <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatCard 
          title="Active Projects" 
          value={stats.active} 
          color="text-emerald-600 dark:text-emerald-400"
          icon={
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard 
          title="Completed" 
          value={stats.completed} 
          color="text-green-600 dark:text-green-400"
          icon={
            <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard 
          title="Total Tasks" 
          value={stats.totalTasks} 
          color="text-indigo-600 dark:text-indigo-400"
          icon={
            <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
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

      {/* Admin Forms */}
      {user?.role === "admin" && (
        <div className="mb-8 grid grid-cols-1 gap-6">
          {/* Create Project Form */}
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 p-2">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Project</h3>
            </div>
            <form onSubmit={createProject} className="space-y-3">
              <input
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
                placeholder="Project title *"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                required
              />
              <textarea
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
                placeholder="Description (optional)"
                rows="2"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
              <select
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={createBatch}
                onChange={(e) => setCreateBatch(e.target.value)}
                required
              >
                <option value="">Assign to batch</option>
                {batchOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
                placeholder="Platform (e.g. MERN, Android, Web)"
                value={createPlatform}
                onChange={(e) => setCreatePlatform(e.target.value)}
              />
              <select
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={createPriority}
                onChange={(e) => setCreatePriority(e.target.value)}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <button
                type="submit"
                className="w-full transform rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
              >
                ✨ Create Project
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Projects Grid */}
      {visibleProjects.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white/80 p-12 text-center shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {searchQuery ? "No projects match your search." : "No projects yet. Create your first project!"}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Projects</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {visibleProjects.length} of {projects.length} projects
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((project) => (
              <ProjectCard
                key={project._id}
                project={project}
                progress={project.stats?.progress || 0}
                canDelete={user?.role === "admin"}
                onDelete={() => setShowDeleteConfirm(project)}
              />
            ))}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete Project?</h3>
            </div>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Are you sure you want to delete "<span className="font-semibold">{showDeleteConfirm.title}</span>"? 
              This will also delete all tasks in this project. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteProject(showDeleteConfirm._id)}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-white transition-all hover:bg-red-600"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;