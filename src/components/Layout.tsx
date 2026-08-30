import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] font-sans text-gray-800 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
        <footer className="px-8 h-12 bg-white border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-widest shrink-0">
          <div>Foundation Build v1.0.0</div>
          <div className="flex gap-4 font-bold">
            <span className="text-orange-500">Firebase Ready</span>
            <span>Gemini AI Ready</span>
            <span>Structured EM Schema v1</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
