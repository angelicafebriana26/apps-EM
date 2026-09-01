import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="flex h-screen w-full bg-[#f8f9fa] font-sans text-gray-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Header />
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
        <footer className="px-6 h-10 bg-white border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-500 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">DAEWOONG BIO QC</span>
            <span className="text-gray-300">|</span>
            <span>EM System v1.2</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] text-gray-500">
            <span>GMP Compliant</span>
            <span className="text-gray-300">•</span>
            <span>21 CFR Part 11 Ready</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
