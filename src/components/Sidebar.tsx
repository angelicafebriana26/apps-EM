import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileUp, Database, LineChart, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "PDF Import", href: "/import", icon: FileUp },
  { name: "EM Data", href: "/data", icon: Database },
  { name: "Trend Analysis", href: "/trends", icon: LineChart },
  { name: "OOS Results", href: "/oos", icon: AlertTriangle },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-[#1A1C1E] flex flex-col h-full shrink-0">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center font-bold text-white">D</div>
          <h1 className="text-xs font-bold text-white uppercase tracking-wider leading-tight">
            Daewoong Bio QC<br />
            <span className="text-orange-400">EM System</span>
          </h1>
        </div>
      </div>
      <nav className="flex-1 py-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                isActive
                  ? "bg-orange-500/10 border-l-4 border-orange-500 text-white"
                  : "text-gray-400 hover:bg-gray-800 border-l-4 border-transparent",
                "px-6 py-3 flex items-center gap-3 transition-colors cursor-pointer"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    isActive ? "text-orange-500" : "",
                    "w-5 h-5 flex-shrink-0"
                  )}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-6 text-[10px] text-gray-500 uppercase tracking-widest border-t border-gray-700">Phase 1 Development</div>
    </aside>
  );
}
