const OverviewCards = ({ stats }) => {
  if (!stats) return null;
  const cards = [
    { label: "Guides", value: stats.guides ?? 0, color: "from-violet-500 to-purple-600" },
    { label: "Students", value: stats.students ?? 0, color: "from-emerald-500 to-teal-600" },
    { label: "Projects", value: stats.projects ?? 0, color: "from-blue-500 to-indigo-600" },
    { label: "Requirements", value: stats.requirements ?? 0, color: "from-amber-500 to-orange-600" },
    {
      label: "Avg completion %",
      value: `${stats.avgCompletionRate ?? 0}%`,
      color: "from-rose-500 to-pink-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl bg-gradient-to-br ${c.color} p-5 text-white shadow-lg`}
        >
          <div className="text-sm font-medium opacity-90">{c.label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight">{c.value}</div>
        </div>
      ))}
    </div>
  );
};

export default OverviewCards;
