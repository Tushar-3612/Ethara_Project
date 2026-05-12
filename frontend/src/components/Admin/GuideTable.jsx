import { useState } from "react";

const GuideTable = ({ guides, onKick, onSaveBatch }) => {
  const [editing, setEditing] = useState(null);
  const [batchVal, setBatchVal] = useState("");

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left dark:bg-gray-900">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Batch</th>
            <th className="px-3 py-2">Completion %</th>
            <th className="px-3 py-2">Stars</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {(guides || []).map((g) => (
            <tr key={g._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <td className="px-3 py-2 font-medium">{g.name}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{g.email}</td>
              <td className="px-3 py-2">
                {editing === g._id ? (
                  <div className="flex gap-1">
                    <input
                      value={batchVal}
                      onChange={(e) => setBatchVal(e.target.value)}
                      className="w-28 rounded border px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900"
                    />
                    <button
                      type="button"
                      className="rounded bg-green-600 px-2 py-0.5 text-xs text-white"
                      onClick={() => {
                        onSaveBatch(g._id, batchVal);
                        setEditing(null);
                      }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-left text-purple-600 hover:underline"
                    onClick={() => {
                      setEditing(g._id);
                      setBatchVal(g.assignedBatch || g.batch || "");
                    }}
                  >
                    {g.assignedBatch || g.batch || "—"}
                  </button>
                )}
              </td>
              <td className="px-3 py-2">
                {g.performanceMetrics?.completionRatePct != null
                  ? `${g.performanceMetrics.completionRatePct}%`
                  : "—"}
              </td>
              <td className="px-3 py-2">{g.stars != null ? `${g.stars}★` : "—"}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onKick(g._id)}
                  className="rounded-lg bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700"
                >
                  Kick
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GuideTable;
