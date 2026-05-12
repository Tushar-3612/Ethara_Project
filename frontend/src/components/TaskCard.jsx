const statusClasses = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "in-progress": "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  blocked: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
};

const priorityClasses = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  medium: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  high: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
};

const TaskCard = ({ task, onStatusChange, readOnly }) => {
  const isOverdue = Boolean(task.isOverdue);
  return (
    <div
      className={`rounded-xl border p-5 shadow-md ${
        isOverdue
          ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/30"
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{task.title}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[task.status] || statusClasses.pending}`}
        >
          {task.status}
        </span>
      </div>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        {task.description || "No description provided."}
      </p>
      {task.projectId?.title && (
        <p className="mb-2 text-xs font-medium text-indigo-600 dark:text-indigo-300">
          Project: {task.projectId.title}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            priorityClasses[task.priority] || priorityClasses.medium
          }`}
        >
          {task.priority || "medium"} priority
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          isOverdue ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-white"
        }`}>
          Deadline: {new Date(task.deadline).toLocaleDateString()}
        </span>
        {isOverdue && (
          <span className="rounded-full bg-rose-200/70 px-3 py-1 text-xs font-semibold text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
            Overdue
          </span>
        )}
      </div>
      {!readOnly && (
        <select
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-black transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          value={task.status}
          onChange={(event) => onStatusChange(task._id, event.target.value)}
        >
          <option value="pending">pending</option>
          <option value="in-progress">in-progress</option>
          <option value="completed">completed</option>
          <option value="blocked">blocked</option>
        </select>
      )}
    </div>
  );
};

export default TaskCard;
