const TopPerformers = ({ topGuides, topStudents }) => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Top 5 guides</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {(topGuides || []).map((g) => (
            <li key={g._id}>
              <span className="font-medium">{g.name}</span>{" "}
              <span className="text-gray-500">
                {g.stars}★ · {g.metrics?.completionRatePct ?? 0}% completion
              </span>
            </li>
          ))}
          {(!topGuides || topGuides.length === 0) && (
            <li className="list-none text-gray-500">No guides yet.</li>
          )}
        </ol>
      </div>
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Top 10 students</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {(topStudents || []).map((s) => (
            <li key={s._id}>
              <span className="font-medium">{s.name}</span>{" "}
              <span className="text-gray-500">
                {s.completionPct ?? 0}% tasks · {s.attendancePct ?? 0}% attendance
              </span>
            </li>
          ))}
          {(!topStudents || topStudents.length === 0) && (
            <li className="list-none text-gray-500">No students yet.</li>
          )}
        </ol>
      </div>
    </div>
  );
};

export default TopPerformers;
