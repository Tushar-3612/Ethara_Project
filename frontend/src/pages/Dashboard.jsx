/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import api from "../services/api";
import TaskCard from "../components/TaskCard.jsx";
import ProjectCard from "../components/ProjectCard.jsx";

const Dashboard = ({ user, searchQuery }) => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [topPerformer, setTopPerformer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statsTimeframe, setStatsTimeframe] = useState("week"); // week, month, all

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await api.get("/tasks");
      setTasks(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await api.get("/activities?limit=15");
      setActivities(response.data);
    } catch {
      setActivities([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get("/projects");
      setProjects(response.data);
    } catch {
      setProjects([]);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchActivities();
    if (user?.role === "admin") {
      api.get("/users/performance").then((res) => setTopPerformer(res.data.bestMember)).catch(() => setTopPerformer(null));
    } else {
      api.get("/users/me/achievements").then((res) => setTopPerformer(res.data.user)).catch(() => setTopPerformer(null));
    }
  }, []);

  const joinProject = async (projectId) => {
    try {
      const res = await api.post(`/projects/${projectId}/join`);
      setProjects((prev) => prev.map((p) => (p._id === projectId ? res.data : p)));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to join project");
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, { status });
      setTasks((prev) =>
        prev.map((task) => (task._id === taskId ? response.data : task))
      );
      fetchActivities();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update task");
    }
  };

  // Filter tasks based on search query
  const visibleTasks = tasks.filter((t) => 
    t.title.toLowerCase().includes((searchQuery || "").toLowerCase()) ||
    t.description?.toLowerCase().includes((searchQuery || "").toLowerCase())
  );
  
  const total = visibleTasks.length;
  const completed = visibleTasks.filter((t) => t.status === "completed").length;
  const inProgress = visibleTasks.filter((t) => t.status === "in-progress").length;
  const blocked = visibleTasks.filter((t) => t.status === "blocked").length;
  const overdue = visibleTasks.filter((t) => t.isOverdue && t.status !== "completed").length;
  const pending = visibleTasks.filter((t) => t.status === "pending").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  
  // Priority distribution
  const highPriority = visibleTasks.filter((t) => t.priority === "high").length;
  const mediumPriority = visibleTasks.filter((t) => t.priority === "medium").length;
  const lowPriority = visibleTasks.filter((t) => t.priority === "low").length;

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Stat Card Component
  const StatCard = ({ title, value, color, icon, bgColor }) => (
    <div className={`group rounded-2xl border ${bgColor || 'border-gray-200 dark:border-gray-700'} bg-white/80 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl dark:bg-gray-800/80`}>
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      {/* Welcome Header */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium opacity-90">{getGreeting()}</p>
            <h1 className="text-3xl font-bold">
              Welcome back, {user?.name?.split(" ")[0] || "User"}! 👋
            </h1>
            <p className="mt-1 text-sm opacity-90">
              {user?.role === "admin" 
                ? "Here's your team's performance overview" 
                : "Here's your personal task summary"}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                fetchTasks();
                fetchProjects();
                fetchActivities();
              }}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/30"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
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

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard 
          title="Total Tasks" 
          value={total} 
          color="text-purple-600 dark:text-purple-400"
          icon={
            <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard 
          title="Completed" 
          value={completed} 
          color="text-emerald-600 dark:text-emerald-400"
          icon={
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard 
          title="In Progress" 
          value={inProgress} 
          color="text-sky-600 dark:text-sky-400"
          icon={
            <svg className="h-5 w-5 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard 
          title="Pending" 
          value={pending} 
          color="text-yellow-600 dark:text-yellow-400"
          icon={
            <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard 
          title="Blocked" 
          value={blocked} 
          color="text-rose-600 dark:text-rose-400"
          icon={
            <svg className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
        <StatCard 
          title="Overdue" 
          value={overdue} 
          color="text-red-600 dark:text-red-400"
          bgColor="border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/30"
          icon={
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Progress and Analytics Row */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Completion Progress */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Completion</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall progress</p>
            </div>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{pct}%</div>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">{completed}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">{total - completed}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">{overdue}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Overdue</div>
            </div>
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Task Priorities</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  High Priority
                </span>
                <span className="font-semibold text-red-600 dark:text-red-400">{highPriority}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full bg-red-500" style={{ width: `${total ? (highPriority / total) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                  Medium Priority
                </span>
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">{mediumPriority}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full bg-yellow-500" style={{ width: `${total ? (mediumPriority / total) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  Low Priority
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400">{lowPriority}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${total ? (lowPriority / total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Tasks Section */}
        <div className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Tasks</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {Math.min(6, visibleTasks.length)} of {visibleTasks.length} tasks
              </p>
            </div>
            {visibleTasks.length > 6 && (
              <button className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400">
                View all →
              </button>
            )}
          </div>

          {visibleTasks.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white/80 p-12 text-center shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="mt-2 text-gray-600 dark:text-gray-400">No tasks found matching your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visibleTasks.slice(0, 6).map((task) => (
                <TaskCard key={task._id} task={task} onStatusChange={updateTaskStatus} readOnly={false} />
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Latest updates from your team</p>
            </div>
            <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {activities.length} updates
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {activities.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white/80 p-8 text-center shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">No activity yet.</p>
              </div>
            ) : (
              activities.map((a, idx) => (
                <div
                  key={a._id || idx}
                  className="group rounded-xl border border-gray-200 bg-white/80 p-4 shadow-md backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg dark:border-gray-700 dark:bg-gray-800/80"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold">
                      {a.actor?.name?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {a.message || "Task updated"}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          {a.actor?.name || "Someone"}
                        </span>
                        <span>•</span>
                        <span>{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Performer Section (if available) */}
      {topPerformer && (
        <div className="mt-8 rounded-2xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 p-6 shadow-lg backdrop-blur-sm border border-purple-200 dark:border-purple-900/30">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="h-20 w-20 rounded-full"
                  style={{ background: `conic-gradient(#8b5cf6 ${Math.min(100, (topPerformer?.rating || 0) * 20)}%, #e2e8f0 0%)` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {Math.round((topPerformer?.rating || 0) * 20)}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">🏆 Top Performer</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{topPerformer?.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {user?.role === "admin" ? "Best team member based on task completion" : "Your performance score"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {topPerformer?.completedTasks || 0} tasks
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">completed</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Projects</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">Select projects to participate</span>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-8 text-center shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
            <p className="text-gray-600 dark:text-gray-400">No projects found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const memberIds = (project.members || []).map((m) => (typeof m === "string" ? m : m._id));
              const meId = user?.id || user?._id;
              const isMember = meId ? memberIds.includes(meId) : false;
              return (
                <div key={project._id} className="min-w-0">
                  <ProjectCard project={project} progress={project.stats?.progress || 0} />
                  {!isMember && user?.role !== "admin" && (
                    <button
                      type="button"
                      onClick={() => joinProject(project._id)}
                      className="mt-3 w-full rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-purple-700"
                    >
                      Join Project
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;