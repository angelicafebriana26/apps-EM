import { useLocation } from "react-router-dom";
import { User } from "lucide-react";

export function Header() {
  const location = useLocation();

  const getPageInfo = (pathname: string) => {
    switch (pathname) {
      case "/":
        return {
          title: "Executive Dashboard",
          subtitle: "Environmental Monitoring Metrics & Compliance",
          tag: "Real-Time Overview",
        };
      case "/import":
        return {
          title: "Certificate of Analysis Import",
          subtitle: "Automated PDF Document Parsing & Review",
          tag: "Data Ingestion",
        };
      case "/data":
        return {
          title: "Environmental Monitoring Records",
          subtitle: "Cleanroom Air, Surface, & Particle Monitoring Database",
          tag: "GMP Database",
        };
      case "/trends":
        return {
          title: "Statistical Trend Analysis",
          subtitle: "12-Month Limits, Trajectories, & Cleanroom Deviations",
          tag: "Trending & Limits",
        };
      case "/oos":
        return {
          title: "Out-of-Specification & Microorganisms",
          subtitle: "Microbiological Non-Conformances & Species Identification",
          tag: "OOS Investigation",
        };
      default:
        return {
          title: "Environmental Monitoring System",
          subtitle: "Daewoong Bio QC Compliance Management",
          tag: "GMP EM",
        };
    }
  };

  const pageInfo = getPageInfo(location.pathname);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 justify-between shrink-0 shadow-2xs select-none">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-sm font-bold text-gray-900 truncate">
          {pageInfo.title}
        </h1>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-600 rounded border border-gray-200 uppercase tracking-wider shrink-0">
          {pageInfo.tag}
        </span>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 leading-tight">Bio QC Team</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 shadow-sm">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
