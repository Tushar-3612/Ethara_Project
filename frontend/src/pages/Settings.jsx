/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../services/api";

const Settings = ({ user }) => {
  const location = useLocation();
  const isTeamMembersPath = location.pathname === "/team-members";
  const [tab, setTab] = useState(user?.role === "admin" && isTeamMembersPath ? "members" : "account");
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamErr, setTeamErr] = useState("");
  const [performance, setPerformance] = useState({ bestMember: null, members: [] });
  const [achievement, setAchievement] = useState({ completedTasks: 0, completedProjects: 0, badges: [] });

  useEffect(() => {
    if (user?.role === "admin" && isTeamMembersPath) setTab("members");
  }, [user?.role, isTeamMembersPath]);

  const fetchTeamList = async () => {
    if (user?.role !== "admin") return;
    setTeamLoading(true);
    try {
      const { data } = await api.get("/users");
      // Fetch task counts for each member
      const membersWithTaskCounts = await Promise.all(
        data.map(async (member) => {
          try {
            const tasksRes = await api.get("/tasks", { params: { user: member._id } });
            const completedTasks = tasksRes.data.filter(t => t.status === "completed").length;
            return { ...member, completedTasks };
          } catch {
            return { ...member, completedTasks: 0 };
          }
        })
      );
      setTeamMembers(Array.isArray(membersWithTaskCounts) ? membersWithTaskCounts : []);
      setTeamErr("");
    } catch {
      setTeamMembers([]);
      setTeamErr("Failed to load users");
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "members" && user?.role === "admin") fetchTeamList();
  }, [tab, user?.role]);

  const fetchAdminData = async () => {
    try {
      const response = await api.get("/users/performance");
      // Fetch additional task counts for each member in performance
      const membersWithTaskCounts = await Promise.all(
        (response.data.members || []).map(async (member) => {
          try {
            const tasksRes = await api.get("/tasks", { params: { user: member._id } });
            const completedTasks = tasksRes.data.filter(t => t.status === "completed").length;
            const totalTasks = tasksRes.data.length;
            return { ...member, completedTasks, totalTasks };
          } catch {
            return { ...member, completedTasks: member.completedTasks || 0, totalTasks: member.totalTasks || 0 };
          }
        })
      );
      setPerformance({ 
        bestMember: response.data.bestMember, 
        members: membersWithTaskCounts 
      });
    } catch {
      setPerformance({ bestMember: null, members: [] });
    }
  };

  const fetchMemberData = async () => {
    try {
      const response = await api.get("/users/me/achievements");
      // Fetch actual completed tasks count
      try {
        const tasksRes = await api.get("/tasks");
        const completedTasks = tasksRes.data.filter(t => t.status === "completed" && t.assignedTo === user?._id).length;
        const completedProjects = [...new Set(tasksRes.data.filter(t => t.status === "completed" && t.assignedTo === user?._id).map(t => t.projectId))].length;
        setAchievement({
          completedTasks,
          completedProjects,
          badges: response.data.badges || []
        });
      } catch {
        setAchievement({
          completedTasks: response.data.completedTasks || 0,
          completedProjects: response.data.completedProjects || 0,
          badges: response.data.badges || []
        });
      }
    } catch {
      setAchievement({ completedTasks: 0, completedProjects: 0, badges: [] });
    }
  };

  useEffect(() => {
    if (user?.role === "admin") fetchAdminData();
    else fetchMemberData();
  }, [user?.role]);

  const updateRating = async (memberId, rating) => {
    try {
      await api.put(`/users/${memberId}/rating`, { rating });
      await fetchAdminData();
      if (tab === "members") await fetchTeamList();
    } catch (err) {
      console.error("Failed to update rating", err);
    }
  };

  const renderStars = (rating) => {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    return `${"★".repeat(r)}${"☆".repeat(5 - r)}`;
  };

  if (isTeamMembersPath && user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const pageTitle = user?.role === "admin" && tab === "members" ? "Team Members" : "Settings";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800">
      {/* Header with gradient */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">{pageTitle}</h1>
            <p className="mt-1 text-sm opacity-90">
              {user?.role === "admin" && tab === "members"
                ? "Manage your team members and their performance"
                : user?.role === "admin"
                  ? "Team performance analytics and member ratings"
                  : "Your achievements and contribution summary"}
            </p>
          </div>
          {user?.role === "admin" && (
            <div className="flex shrink-0 flex-wrap gap-2 rounded-xl bg-white/20 p-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => {
                  setTab("members");
                  fetchTeamList();
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  tab === "members" 
                    ? "bg-white text-purple-600 shadow-md" 
                    : "text-white hover:bg-white/20"
                }`}
              >
                <svg className="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Team Members
              </button>
              <button
                type="button"
                onClick={() => setTab("account")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  tab === "account" 
                    ? "bg-white text-purple-600 shadow-md" 
                    : "text-white hover:bg-white/20"
                }`}
              >
                <svg className="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Team Members Section */}
      {user?.role === "admin" && tab === "members" && (
        <section className="mb-10">
          {teamErr && (
            <div className="mb-4 rounded-xl bg-rose-100/90 p-3 text-sm text-rose-800 backdrop-blur-sm dark:bg-rose-900/40 dark:text-rose-200">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {teamErr}
              </div>
            </div>
          )}
          {teamLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading team members...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Team Members</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {teamMembers.length} members
                  </p>
                </div>
                <button
                  onClick={fetchTeamList}
                  className="rounded-xl bg-purple-500 px-3 py-1.5 text-sm text-white hover:bg-purple-600"
                >
                  ↻ Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {teamMembers.map((member) => (
                  <div
                    key={member._id}
                    className="group rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800/80"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold">
                            {member.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                              {member.name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="text-lg text-amber-500">{renderStars(member.rating)}</div>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Tasks completed</span>
                            <span className="font-semibold text-purple-600 dark:text-purple-400">
                              {member.completedTasks != null ? member.completedTasks : "—"}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Role</span>
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium capitalize text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {member.role || "member"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Account Section */}
      {(tab === "account" || user?.role !== "admin") && (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Profile Card */}
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl dark:border-gray-700 dark:bg-gray-800/80">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 p-2">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Information</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
                <span className="font-medium text-gray-900 dark:text-white">{user?.name || "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
                <span className="font-medium text-gray-900 dark:text-white break-all text-right">{user?.email || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold capitalize text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {user?.role || "member"}
                </span>
              </div>
            </div>
          </div>

          {/* Best Member / Achievements Card */}
          {user?.role === "admin" ? (
            <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl dark:border-gray-700 dark:bg-gray-800/80">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 p-2">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Performer</h3>
              </div>
              {performance.bestMember ? (
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-2xl font-bold text-white">
                    {performance.bestMember.name?.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">{performance.bestMember.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Completed: {performance.bestMember.completedTasks || 0} tasks
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">No data yet</p>
              )}
            </div>
          ) : (
            <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl dark:border-gray-700 dark:bg-gray-800/80">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-full bg-gradient-to-r from-green-500 to-emerald-500 p-2">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Achievements</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl bg-purple-50 p-3 text-center dark:bg-purple-900/20">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{achievement.completedTasks}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Tasks Completed</div>
                </div>
                <div className="rounded-xl bg-indigo-50 p-3 text-center dark:bg-indigo-900/20">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{achievement.completedProjects}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Projects Completed</div>
                </div>
              </div>
              {achievement.badges?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Badges Earned:</p>
                  <div className="flex flex-wrap gap-2">
                    {(achievement.badges || []).map((badge) => (
                      <span key={badge} className="rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
                        🏆 {badge}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rate Members Section (Admin only) */}
      {user?.role === "admin" && tab === "account" && performance.members?.length > 0 && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 p-2">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rate Team Members</h3>
          </div>
          <div className="space-y-3">
            {performance.members.map((member) => (
              <div
                key={member._id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-4 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">{member.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Completed {member.completedTasks || 0}/{member.totalTasks || 0} tasks
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Rating:</span>
                  <select
                    value={member.rating || 3}
                    onChange={(e) => updateRating(member._id, Number(e.target.value))}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5].map((s) => (
                      <option key={s} value={s}>
                        {"★".repeat(s)} ({s})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;