import { useState } from "react";
import { AlertCircle, Bug } from "lucide-react";
import { cn } from "../lib/utils";

export function OosResults() {
  const [activeTab, setActiveTab] = useState<'records' | 'microorganism'>('records');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      {/* Tabs Header */}
      <div className="border-b border-gray-200 bg-gray-50/50">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('records')}
            className={cn(
              activeTab === 'records'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors'
            )}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            OOS Records
          </button>
          <button
            onClick={() => setActiveTab('microorganism')}
            className={cn(
              activeTab === 'microorganism'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors'
            )}
          >
            <Bug className="mr-2 h-4 w-4" />
            Microorganism Analysis
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'records' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Years</option>
                </select>
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Months</option>
                </select>
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Rooms</option>
                </select>
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Parameters</option>
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="border border-gray-100 rounded-lg overflow-hidden h-full">
                <table className="w-full text-xs text-left relative">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Date of EM Measurement</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Sample Submission Date</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Room</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Parameter</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Result</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Applicable Limit</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Microorganism ID Status</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Microorganism Name</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">
                        <AlertCircle className="mx-auto h-8 w-8 text-gray-200 mb-3" />
                        <p className="text-gray-400 font-semibold italic">No OOS records</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'microorganism' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Years</option>
                </select>
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Months</option>
                </select>
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Rooms</option>
                </select>
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Parameters</option>
                </select>
                <select className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white">
                  <option value="">All Organisms</option>
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="border border-gray-100 rounded-lg overflow-hidden h-full">
                <table className="w-full text-xs text-left relative">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Room</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Organism</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Parameter</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Occurrences</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                        <Bug className="mx-auto h-8 w-8 text-gray-200 mb-3" />
                        <p className="text-gray-400 font-semibold italic">No microorganism data</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
