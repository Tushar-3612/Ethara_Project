const ProjectTable = ({ projects, onApproval }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left dark:bg-gray-900">
          <tr>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Guide</th>
            <th className="px-3 py-2">Batches</th>
            <th className="px-3 py-2">Admin status</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {(projects || []).map((p) => (
            <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <td className="px-3 py-2 font-medium">{p.title}</td>
              <td className="px-3 py-2">{p.guide?.name || "—"}</td>
              <td className="px-3 py-2">{(p.targetBatches || []).join(", ") || "—"}</td>
              <td className="px-3 py-2 capitalize">{p.adminApproval || "approved"}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded bg-green-600 px-2 py-0.5 text-xs text-white"
                    onClick={() => onApproval(p._id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded bg-amber-600 px-2 py-0.5 text-xs text-white"
                    onClick={() => onApproval(p._id, "pending")}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    className="rounded bg-rose-600 px-2 py-0.5 text-xs text-white"
                    onClick={() => onApproval(p._id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectTable;
