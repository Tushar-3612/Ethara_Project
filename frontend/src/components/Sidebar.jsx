import { Link, useLocation } from "react-router-dom";

const baseLinks = [{ to: "/projects", label: "Projects", icon: "🗂️" }];

const Sidebar = ({ user, mobileOpen, onCloseMobile }) => {
  const location = useLocation();

  const dashboardLink =
    user?.role === "admin"
      ? { to: "/admin/dashboard", label: "Dashboard", icon: "📊" }
      : user?.role === "guide"
        ? { to: "/guide/dashboard", label: "Dashboard", icon: "📊" }
        : { to: "/dashboard", label: "Dashboard", icon: "📊" };

  const adminTeamLink =
    user?.role === "admin" ? [{ to: "/team-members", label: "Team Members", icon: "👥" }] : [];
  const memberAttendance =
    user?.role === "member" ? [{ to: "/attendance", label: "Attendance", icon: "📅" }] : [];
  const roleLinks =
    user?.role === "admin"
      ? baseLinks
      : [...baseLinks, ...memberAttendance, { to: "/tasks", label: "Tasks", icon: "✅" }];
  const links = [dashboardLink, ...roleLinks, ...adminTeamLink, { to: "/settings", label: "Settings", icon: "⚙️" }];

  const handleNavigate = () => {
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-[100dvh] w-[min(16rem,calc(100vw-3rem))] max-w-[16rem] flex-col border-r border-gray-200 bg-white p-4 backdrop-blur transition-transform duration-200 ease-out dark:border-gray-700 dark:bg-gray-800 md:static md:z-0 md:h-auto md:w-64 md:max-w-none md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="mb-4 min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">Team Task Manager</div>
        {user && (
          <div className="mt-1 break-all text-xs text-gray-600 dark:text-gray-400">
            {user.name} • <span className="font-medium">{user.role}</span>
          </div>
        )}
      </div>

      <nav className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto">
        {links.map((link) => {
          const isActive =
            location.pathname === link.to ||
            (link.to === "/team-members" && location.pathname.startsWith("/team-members"));
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={handleNavigate}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-purple-500 text-white shadow-md"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <span aria-hidden>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
