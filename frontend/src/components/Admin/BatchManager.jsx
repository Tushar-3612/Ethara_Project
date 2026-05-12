import { useState } from "react";

const BatchManager = ({ batches, guides, onCreate, onDelete, onAssignGuide }) => {
  const [name, setName] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate(name.trim());
          setName("");
        }}
      >
        <div>
          <label className="mb-1 block text-xs text-gray-500">New batch name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            placeholder="e.g. BCA 3rd Sem"
          />
        </div>
        <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white">
          Create batch
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2">Assigned guide</th>
              <th className="px-3 py-2">Assign / change</th>
              <th className="px-3 py-2">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(batches || []).map((b) => (
              <tr key={b._id}>
                <td className="px-3 py-2 font-medium">{b.name}</td>
                <td className="px-3 py-2">{b.guide?.name || "—"}</td>
                <td className="px-3 py-2">
                  <select
                    className="max-w-[180px] rounded border px-1 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
                    defaultValue=""
                    onChange={(e) => {
                      const gid = e.target.value;
                      e.target.value = "";
                      if (gid) onAssignGuide(b._id, gid);
                    }}
                  >
                    <option value="">Select guide…</option>
                    {(guides || []).map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onDelete(b._id)}
                    className="rounded bg-rose-600 px-2 py-1 text-xs text-white"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BatchManager;
