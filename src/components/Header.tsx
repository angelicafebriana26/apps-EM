import { useLocation } from "react-router-dom";

export function Header() {
  const location = useLocation();
  
  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/': return 'Dashboard';
      case '/import': return 'PDF Import';
      case '/data': return 'EM Data';
      case '/trends': return 'Trend Analysis';
      case '/oos': return 'OOS Results';
      default: return 'Dashboard';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between shrink-0">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-800">{getPageTitle(location.pathname)} Overview</h2>
        <span className="px-2 py-1 bg-gray-100 text-[10px] font-bold text-gray-500 rounded uppercase tracking-tighter">System Database</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right flex flex-col justify-center h-8">
          <p className="text-xs font-bold text-gray-700">QC Admin</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-200"></div>
      </div>
    </header>
  );
}
