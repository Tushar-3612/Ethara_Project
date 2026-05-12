const StudentTable = ({ students, guides, onKick, onRestore, onReassign }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left dark:bg-gray-900">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Batch</th>
            <th className="px-3 py-2">Completion %</th>
            <th className="px-3 py-2">Attendance %</th>
            <th className="px-3 py-2">Active</th>
            <th className="px-3 py-2">Reassign</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {(students || []).map((s) => (
            <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <td className="px-3 py-2 font-medium">{s.name}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{s.email}</td>
              <td className="px-3 py-2">{s.batch || "—"}</td>
              <td className="px-3 py-2">{s.completionPct ?? 0}%</td>
              <td className="px-3 py-2">{s.attendancePct ?? 0}%</td>
              <td className="px-3 py-2">{s.isActive === false ? "No" : "Yes"}</td>
              <td className="px-3 py-2">
                <select
                  className="max-w-[140px] rounded border px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900"
                  defaultValue=""
                  onChange={(e) => {
                    const gid = e.target.value;
                    e.target.value = "";
                    if (gid) onReassign(s._id, gid);
                  }}
                >
                  <option value="">Guide…</option>
                  {(guides || []).map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {s.isActive !== false ? (
                    <button
                      type="button"
                      onClick={() => onKick(s._id)}
                      className="rounded bg-rose-600 px-2 py-0.5 text-xs text-white"
                    >
                      Kick
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRestore(s._id)}
                      className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentTable;
