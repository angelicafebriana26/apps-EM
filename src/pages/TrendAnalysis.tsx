import { LineChart, BarChart } from "lucide-react";

export function TrendAnalysis() {
  return (
    <div className="space-y-6">
      {/* Filters Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-6">
          <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
          Trend Analysis Parameters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Year</label>
            <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
              <option value="">Select Year</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Test Parameter</label>
            <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
              <option>부유입자 ≥0.5 μm</option>
              <option>부유입자 ≥5.0 μm</option>
              <option>부유균</option>
              <option>낙하균</option>
              <option>표면균</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Room</label>
            <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
              <option value="all">All Rooms</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Month Range</label>
            <div className="flex items-center space-x-2">
              <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                <option value="">From month</option>
              </select>
              <span className="text-gray-400">→</span>
              <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                <option value="">To month</option>
              </select>
              <button type="button" className="inline-flex items-center justify-center px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-[10px] uppercase tracking-widest rounded border border-gray-200 transition-colors w-32">
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Monthly Trend
          </h3>
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <div className="w-full h-full bg-gray-50 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 p-6">
            <LineChart className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm italic text-center max-w-lg mt-2">
              Import Environmental Monitoring data to generate trend analysis. Future graph will display actual results, monthly average, maximum, alert/action limits, and OOS markers.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Monthly Summary
          </h3>
        </div>
        <div className="p-6">
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Measurements</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Average</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Maximum</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Minimum</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Alert</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">OOS</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-gray-400 italic">
                    No data to summarize
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
