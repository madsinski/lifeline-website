"use client";

const clientStats = [
  { label: "Total Clients", value: "247" },
  { label: "Bronze", value: "68" },
  { label: "Silver", value: "82" },
  { label: "Gold", value: "64" },
  { label: "Platinum", value: "33" },
  { label: "Active Rate", value: "76.5%" },
];

const assessmentStats = [
  { label: "Total Completed", value: "412" },
  { label: "Full Health Assessment", value: "198" },
  { label: "Focused Package", value: "134" },
  { label: "Quick Check", value: "80" },
  { label: "Avg. Score", value: "74/100" },
];

const coachingStats = [
  { label: "Action Completion Rate", value: "68%" },
  { label: "Most Popular Program", value: "Beginner Strength" },
  { label: "Least Popular Program", value: "Advanced Mindfulness" },
  { label: "Avg. Actions/Day", value: "3.2" },
  { label: "Streak Leaders", value: "14 clients > 30 days" },
];

const revenueByTier = [
  { tier: "Bronze", clients: 68, pricePerMonth: 9900, total: 673200 },
  { tier: "Silver", clients: 82, pricePerMonth: 19900, total: 1631800 },
  { tier: "Gold", clients: 64, pricePerMonth: 34900, total: 2233600 },
  { tier: "Platinum", clients: 33, pricePerMonth: 59900, total: 1976700 },
];

const totalRevenue = revenueByTier.reduce((s, r) => s + r.total, 0);

const monthlyRevenue = [
  { month: "Oct", revenue: 4800000 },
  { month: "Nov", revenue: 5100000 },
  { month: "Dec", revenue: 5340000 },
  { month: "Jan", revenue: 5680000 },
  { month: "Feb", revenue: 6020000 },
  { month: "Mar", revenue: 6515300 },
];

function formatISK(amount: number) {
  return `kr ${(amount / 1000).toFixed(0)}k`;
}

function ChartPlaceholder({ label }: { label: string }) {
  return (
    <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center">
      <span className="text-sm text-gray-400 font-medium">{label}</span>
    </div>
  );
}

function StatGrid({
  title,
  stats,
}: {
  title: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-[#1F2937] mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              {s.label}
            </p>
            <p className="text-xl font-bold text-[#1F2937] mt-1">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue));

  return (
    <div className="space-y-6">
      {/* Client Statistics */}
      <StatGrid title="Client Statistics" stats={clientStats} />

      {/* Client Growth Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          Client Distribution by Tier
        </h2>
        <ChartPlaceholder label="Chart: Client distribution pie chart - Bronze 68, Silver 82, Gold 64, Platinum 33" />
      </div>

      {/* Assessment Stats */}
      <StatGrid title="Assessment Statistics" stats={assessmentStats} />

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          Assessments Over Time
        </h2>
        <ChartPlaceholder label="Chart: Monthly assessments completed - line chart" />
      </div>

      {/* Coaching Stats */}
      <StatGrid title="Coaching Statistics" stats={coachingStats} />

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          Action Completion Trend
        </h2>
        <ChartPlaceholder label="Chart: Daily action completion rate - area chart" />
      </div>

      {/* Revenue Overview */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          Revenue Overview (Mock)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Monthly Recurring Revenue
            </p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">
              kr {(totalRevenue / 1000).toLocaleString()}k
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Paying Clients
            </p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">247</p>
          </div>
        </div>

        {/* Revenue by tier table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3">
                  Tier
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3">
                  Clients
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3">
                  Price/Mo
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3">
                  MRR
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {revenueByTier.map((row, idx) => (
                <tr
                  key={row.tier}
                  className={idx % 2 === 1 ? "bg-gray-50/50" : ""}
                >
                  <td className="py-2.5 px-3 text-sm font-medium text-[#1F2937]">
                    {row.tier}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-gray-600">
                    {row.clients}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-gray-600">
                    kr {(row.pricePerMonth / 100).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-sm font-medium text-[#1F2937]">
                    {formatISK(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td className="py-2.5 px-3 text-sm font-bold text-[#1F2937]">
                  Total
                </td>
                <td className="py-2.5 px-3 text-sm font-bold text-[#1F2937]">
                  247
                </td>
                <td className="py-2.5 px-3" />
                <td className="py-2.5 px-3 text-sm font-bold text-[#20c858]">
                  {formatISK(totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          Monthly Revenue Trend
        </h2>
        <div className="flex items-end gap-3 h-48">
          {monthlyRevenue.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-600">
                {formatISK(m.revenue)}
              </span>
              <div
                className="w-full bg-[#20c858] rounded-t-md transition-all"
                style={{ height: `${(m.revenue / maxRevenue) * 100}%` }}
              />
              <span className="text-xs text-gray-400">{m.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
