import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileUp,
  Database,
  LineChart,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "PDF Import", href: "/import", icon: FileUp },
  { name: "EM Data", href: "/data", icon: Database },
  { name: "Trend Analysis", href: "/trends", icon: LineChart },
  { name: "OOS Results", href: "/oos", icon: AlertTriangle },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-[#111315] border-r border-[#22252A] flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#22252A]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-600 rounded-lg flex items-center justify-center font-black text-white text-base shadow-sm shrink-0 ring-1 ring-orange-500/30">
            D
          </div>
          <div className="min-w-0">
            <h1 className="text-[11px] font-bold text-gray-300 uppercase tracking-wider leading-tight truncate">
              DAEWOONG BIO QC
            </h1>
            <p className="text-xs font-black text-orange-500 uppercase tracking-wider leading-tight mt-0.5">
              ENVIRONMENTAL<br />
              MONITORING DATA
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          EM Modules
        </div>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              cn(
                "group relative px-3.5 py-2.5 rounded-lg flex items-center gap-3 text-xs font-medium cursor-pointer transition-all duration-200 ease-in-out",
                isActive
                  ? "bg-orange-500/10 text-white font-semibold shadow-2xs"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.05]"
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active Orange Indicator Bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-1 bg-orange-500 rounded-r transition-all duration-200"
                    aria-hidden="true"
                  />
                )}
                <item.icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors duration-200",
                    isActive
                      ? "text-orange-500"
                      : "text-gray-400 group-hover:text-gray-200"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Pharmaceutical System Footer */}
      <div className="p-4 border-t border-[#22252A] bg-[#0E1012]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              QC System Active
            </span>
          </div>
          <span className="text-[9px] font-mono text-gray-400 uppercase">
            GMP EM
          </span>
        </div>
      </div>
    </aside>
  );
}
