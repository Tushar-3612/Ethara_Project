import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import GuideDashboard from "./pages/GuideDashboard.jsx";
import UserDashboard from "./pages/UserDashboard.jsx";
import Projects from "./pages/Projects.jsx";
import Tasks from "./pages/Tasks.jsx";
import Settings from "./pages/Settings.jsx";
import UserAttendance from "./pages/UserAttendance.jsx";

const ProtectedLayout = ({ user, onLogout, theme, onToggleTheme, searchQuery, setSearchQuery }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const title = location.pathname.startsWith("/projects")
    ? "Projects"
    : location.pathname.startsWith("/tasks")
      ? "Tasks"
      : location.pathname.startsWith("/attendance")
        ? "Attendance"
        : location.pathname.startsWith("/team-members")
          ? "Team Members"
          : location.pathname.startsWith("/settings")
            ? "Settings"
            : location.pathname.startsWith("/admin")
              ? "Admin Dashboard"
              : location.pathname.startsWith("/guide")
                ? "Guide Dashboard"
                : "Dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-white">
      <Navbar
        title={title}
        theme={theme}
        onToggleTheme={onToggleTheme}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLogout={onLogout}
        onProfile={() => navigate("/settings")}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar user={user} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden bg-gray-100 dark:bg-gray-900">
          <Routes>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/guide" element={<Navigate to="/guide/dashboard" replace />} />
            <Route
              path="/admin/dashboard"
              element={user?.role === "admin" ? <AdminDashboard /> : <Navigate to="/dashboard" replace />}
            />
            <Route
              path="/guide/dashboard"
              element={user?.role === "guide" ? <GuideDashboard user={user} /> : <Navigate to="/dashboard" replace />}
            />
            <Route
              path="/dashboard"
              element={user?.role === "member" ? <UserDashboard user={user} /> : <Navigate to="/" replace />}
            />
            <Route path="/projects" element={<Projects searchQuery={searchQuery} />} />
            <Route path="/tasks" element={<Tasks user={user} searchQuery={searchQuery} />} />
            <Route
              path="/attendance"
              element={
                user?.role === "member" ? (
                  <UserAttendance />
                ) : (
                  <Navigate
                    to={user?.role === "guide" ? "/guide/dashboard" : "/admin/dashboard"}
                    replace
                  />
                )
              }
            />
            <Route path="/settings" element={<Settings user={user} />} />
            <Route path="/team-members" element={<Settings user={user} />} />
            <Route
              path="*"
              element={
                user?.role === "admin" ? (
                  <Navigate to="/admin/dashboard" replace />
                ) : user?.role === "guide" ? (
                  <Navigate to="/guide/dashboard" replace />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};

function AppContent() {
  const { token, user, login, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const protectedPaths = useMemo(
    () => [
      "/dashboard",
      "/admin",
      "/admin/dashboard",
      "/guide",
      "/guide/dashboard",
      "/projects",
      "/tasks",
      "/attendance",
      "/settings",
      "/team-members",
    ],
    []
  );

  if (!token && protectedPaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          token && user ? (
            user.role === "admin" ? (
              <Navigate to="/admin/dashboard" replace />
            ) : user.role === "guide" ? (
              <Navigate to="/guide/dashboard" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/login"
        element={
          token && user ? (
            user.role === "admin" ? (
              <Navigate to="/admin/dashboard" replace />
            ) : user.role === "guide" ? (
              <Navigate to="/guide/dashboard" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Login onLogin={login} />
          )
        }
      />
      <Route path="/signup" element={token ? <Navigate to="/" replace /> : <Signup onLogin={login} />} />
      <Route
        path="/*"
        element={
          token && user ? (
            <ProtectedLayout
              user={user}
              onLogout={logout}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return <AppContent />;
}
