import AvatarDropdown from "./AvatarDropdown.jsx";

const Navbar = ({
  title = "Dashboard",
  onToggleTheme,
  theme,
  searchQuery,
  onSearchChange,
  onLogout,
  onProfile,
  onOpenMobileNav,
}) => {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 backdrop-blur sm:px-6 sm:py-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            onClick={() => onOpenMobileNav?.()}
            className="mt-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-lg leading-none md:hidden dark:border-gray-600 dark:bg-gray-900"
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-gray-900 sm:text-xl dark:text-white">{title}</h1>
            <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
             Simple Task Manager Dashboard 
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3 md:w-auto md:flex-nowrap">
          <div className="order-last flex w-full min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-md transition-all dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 md:order-none md:flex md:w-auto">
            <span className="shrink-0 text-gray-400 dark:text-gray-500">🔎</span>
            <input
              className="min-w-0 flex-1 bg-white text-black placeholder-gray-400 outline-none transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 md:w-56 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
              placeholder="Tasks, projects…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-xl bg-gray-200 px-3 py-2 text-sm shadow-md transition-all hover:opacity-90 dark:bg-gray-700 dark:text-white"
            aria-label="Toggle theme"
            title="Toggle dark mode"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button> */}

          {/* <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-md hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-700"
            aria-label="Notifications"
          >
            🔔
          </button> */}

          <AvatarDropdown onLogout={onLogout} onProfile={onProfile} />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
