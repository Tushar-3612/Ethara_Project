/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import api from "../services/api";
import TaskCard from "../components/TaskCard.jsx";

const Tasks = ({ user, searchQuery = "" }) => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [editingTask, setEditingTask] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    overdue: 0,
  });
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    projectId: "",
    assignedTo: "",
    deadline: "",
    priority: "medium",
    status: "pending",
  });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {};
      
      if (filter !== "all" && filter !== "overdue") {
        params.status = filter;
      }
      
      if (projectFilter !== "all") {
        params.project = projectFilter;
      }
      
      if (user?.role === "admin") {
        if (userFilter !== "all") {
          params.user = userFilter;
        }
      } else {
        params.user = user?.id || user?._id;
      }
      
      const response = await api.get("/tasks", { params });
      setTasks(response.data);
      calculateStats(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (tasksList) => {
    const total = tasksList.length;
    const completed = tasksList.filter(t => t.status === "completed").length;
    const pending = tasksList.filter(t => t.status === "pending").length;
    const inProgress = tasksList.filter(t => t.status === "in-progress").length;
    const overdue = tasksList.filter(t => t.isOverdue && t.status !== "completed").length;
    
    setStats({ total, completed, pending, inProgress, overdue });
  };

  useEffect(() => {
    fetchTasks();
    api.get("/projects").then((res) => setProjects(res.data)).catch(() => setProjects([]));
    if (user?.role === "admin") {
      api.get("/users").then((res) => setUsers(res.data)).catch(() => setUsers([]));
    }
  }, []);
  
  useEffect(() => {
    fetchTasks();
  }, [filter, projectFilter, userFilter]);

  const createTask = async (event) => {
    event.preventDefault();
    if (!newTask.title.trim()) {
      setError("Task title is required");
      return;
    }
    if (!newTask.projectId) {
      setError("Please select a project");
      return;
    }
    if (!newTask.assignedTo) {
      setError("Please assign to a user");
      return;
    }
    if (!newTask.deadline) {
      setError("Please select a deadline");
      return;
    }
    
    try {
      await api.post("/tasks", newTask);
      setNewTask({
        title: "",
        description: "",
        projectId: "",
        assignedTo: "",
        deadline: "",
        priority: "medium",
        status: "pending",
      });
      await fetchTasks();
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create task");
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, { status });
      const updatedTasks = tasks.map((t) => (t._id === taskId ? response.data : t));
      setTasks(updatedTasks);
      calculateStats(updatedTasks);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update task");
    }
  };

  const updateTask = async (taskId, updatedData) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, updatedData);
      const updatedTasks = tasks.map((t) => (t._id === taskId ? response.data : t));
      setTasks(updatedTasks);
      calculateStats(updatedTasks);
      setEditingTask(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update task");
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      const updatedTasks = tasks.filter((t) => t._id !== taskId);
      setTasks(updatedTasks);
      calculateStats(updatedTasks);
      setShowDeleteConfirm(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete task");
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (!searchQuery) return true;
    return task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           task.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const displayTasks = filter === "overdue" 
    ? filteredTasks.filter(t => t.isOverdue && t.status !== "completed")
    : filteredTasks;

  const StatCard = ({ title, value, color, icon }) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`rounded-full p-2 ${color.replace("text", "bg")} bg-opacity-10`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Task Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user?.role === "admin" 
                ? "Manage all tasks across your organization" 
                : "View and update your assigned tasks"}
            </p>
          </div>
          <button
            onClick={fetchTasks}
            className="flex items-center gap-2 rounded-xl bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard 
          title="Total Tasks" 
          value={stats.total} 
          color="text-purple-600 dark:text-purple-400"
          icon={
            <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard 
          title="Completed" 
          value={stats.completed} 
          color="text-emerald-600 dark:text-emerald-400"
          icon={
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard 
          title="Pending" 
          value={stats.pending} 
          color="text-yellow-600 dark:text-yellow-400"
          icon={
            <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard 
          title="In Progress" 
          value={stats.inProgress} 
          color="text-blue-600 dark:text-blue-400"
          icon={
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard 
          title="Overdue" 
          value={stats.overdue} 
          color="text-red-600 dark:text-red-400"
          icon={
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">📁 All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.title}</option>
          ))}
        </select>
        
        {user?.role === "admin" && (
          <select
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          >
            <option value="all">👥 All Users</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        )}
        
        <select
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">🎯 All Status</option>
          <option value="pending">⏳ Pending</option>
          <option value="in-progress">🔄 In Progress</option>
          <option value="blocked">🚫 Blocked</option>
          <option value="completed">✅ Completed</option>
          <option value="overdue">⚠️ Overdue</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Create Task Form - Admin Only */}
      {user?.role === "admin" && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Create New Task</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <input
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
              placeholder="Task title *"
              value={newTask.title}
              onChange={(e) => setNewTask((v) => ({ ...v, title: e.target.value }))}
            />
            <input
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
              placeholder="Description"
              value={newTask.description}
              onChange={(e) => setNewTask((v) => ({ ...v, description: e.target.value }))}
            />
            <select
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              value={newTask.projectId}
              onChange={(e) => setNewTask((v) => ({ ...v, projectId: e.target.value }))}
            >
              <option value="">Select project *</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
            </select>
            <select
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              value={newTask.assignedTo}
              onChange={(e) => setNewTask((v) => ({ ...v, assignedTo: e.target.value }))}
            >
              <option value="">Assign to user *</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
            <input
              type="date"
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              value={newTask.deadline}
              onChange={(e) => setNewTask((v) => ({ ...v, deadline: e.target.value }))}
            />
            <select
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              value={newTask.priority}
              onChange={(e) => setNewTask((v) => ({ ...v, priority: e.target.value }))}
            >
              <option value="low">🟢 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🔴 High</option>
            </select>
            <button 
              onClick={createTask}
              className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-purple-600"
            >
              Create Task
            </button>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Loading tasks...</p>
          </div>
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-2 text-gray-500 dark:text-gray-400">No tasks found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayTasks.map((task) => (
            <div key={task._id} className="group relative">
              <TaskCard 
                task={task} 
                onStatusChange={updateTaskStatus} 
                readOnly={false}
              />
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => setEditingTask(task)}
                  className="rounded-lg bg-white p-1.5 text-blue-500 shadow-md hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {user?.role === "admin" && (
                  <button
                    onClick={() => setShowDeleteConfirm(task)}
                    className="rounded-lg bg-white p-1.5 text-red-500 shadow-md hover:bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Task?</h3>
            <p className="my-3 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete "{showDeleteConfirm.title}"?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={() => deleteTask(showDeleteConfirm._id)} className="flex-1 rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Task</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              updateTask(editingTask._id, {
                title: formData.get("title"),
                description: formData.get("description"),
                priority: formData.get("priority"),
                deadline: formData.get("deadline"),
                status: formData.get("status"),
              });
            }}>
              <div className="mt-3 space-y-3">
                <input name="title" defaultValue={editingTask.title} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white" required />
                <textarea name="description" defaultValue={editingTask.description} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white" rows="2" />
                <select name="priority" defaultValue={editingTask.priority} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input name="deadline" type="date" defaultValue={editingTask.deadline?.split("T")[0]} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                <select name="status" defaultValue={editingTask.status} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setEditingTask(null)} className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-lg bg-purple-500 px-3 py-1.5 text-sm text-white hover:bg-purple-600">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;