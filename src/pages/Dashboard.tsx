import { Activity, Map, CheckCircle, AlertTriangle, AlertOctagon, XCircle } from "lucide-react";

export function Dashboard() {
  const summaryCards = [
    { title: "Total EM", value: "0", color: "" },
    { title: "Total Rooms", value: "0", color: "" },
    { title: "Pass", value: "0", color: "border-l-4 border-l-green-500", textClass: "text-green-600" },
    { title: "Alert", value: "0", color: "border-l-4 border-l-yellow-400", textClass: "text-yellow-600" },
    { title: "Action", value: "0", color: "border-l-4 border-l-orange-500", textClass: "text-orange-600" },
    { title: "OOS", value: "0", color: "border-l-4 border-l-red-600", textClass: "text-red-600" },
  ];

  return (
    <div className="flex-1 overflow-hidden space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <div key={card.title} className={`bg-white p-4 border border-gray-200 rounded-lg shadow-sm ${card.color}`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase">{card.title}</p>
            <p className={`text-2xl font-semibold mt-1 ${card.textClass || ''}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[460px]">
        {/* Monthly Trend Preview */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl flex flex-col p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
              Monthly Trend Preview
            </h3>
            <div className="flex gap-1 flex-wrap">
              <span className="px-2 py-1 bg-orange-50 text-[10px] font-semibold text-orange-600 border border-orange-200 rounded">부유입자 ≥0.5 μm</span>
              <span className="px-2 py-1 text-[10px] font-semibold text-gray-400 rounded">부유입자 ≥5.0 μm</span>
              <span className="px-2 py-1 text-[10px] font-semibold text-gray-400 rounded">부유균</span>
              <span className="px-2 py-1 text-[10px] font-semibold text-gray-400 rounded">낙하균</span>
              <span className="px-2 py-1 text-[10px] font-semibold text-gray-400 rounded">표면균</span>
            </div>
          </div>
          <div className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400">
            <Activity className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm italic text-center px-4">Trend graph visualization will appear after EM data import</p>
          </div>
        </div>

        {/* Recent OOS Results */}
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col p-6 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
            <span className="w-2 h-4 bg-red-600 rounded-full"></span>
            Recent OOS Results
          </h3>
          <div className="flex-1 border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-500">Date</th>
                  <th className="px-3 py-2 font-semibold text-gray-500">Room</th>
                  <th className="px-3 py-2 font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-gray-400 italic">No OOS data imported yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button className="mt-4 w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-[10px] uppercase tracking-widest rounded border border-gray-200 transition-colors">View Detailed Logs</button>
        </div>
      </div>
    </div>
  );
}
