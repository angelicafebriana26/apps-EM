import React, { useEffect, useState, useMemo } from "react";
import { 
  Database, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  XCircle, 
  ArrowRight, 
  FileUp, 
  TrendingUp, 
  RotateCcw, 
  Filter, 
  ShieldAlert, 
  Layers, 
  Activity,
  Calendar,
  Bug,
  LineChart as LineChartIcon,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { getEMMeasurements, EMMeasurementRecord } from "../services/emDatabaseService";
import { RoomGroup, ExtractedRecord } from "../types";
import { Link } from "react-router-dom";

const PARAMETERS = [
  "부유입자 ≥0.5 μm",
  "부유입자 ≥5.0 μm",
  "부유균",
  "낙하균",
  "표면균"
];

const MONTH_OPTIONS = [
  { value: "01", label: "01 (Jan)", monthNum: 1 },
  { value: "02", label: "02 (Feb)", monthNum: 2 },
  { value: "03", label: "03 (Mar)", monthNum: 3 },
  { value: "04", label: "04 (Apr)", monthNum: 4 },
  { value: "05", label: "05 (May)", monthNum: 5 },
  { value: "06", label: "06 (Jun)", monthNum: 6 },
  { value: "07", label: "07 (Jul)", monthNum: 7 },
  { value: "08", label: "08 (Aug)", monthNum: 8 },
  { value: "09", label: "09 (Sep)", monthNum: 9 },
  { value: "10", label: "10 (Oct)", monthNum: 10 },
  { value: "11", label: "11 (Nov)", monthNum: 11 },
  { value: "12", label: "12 (Dec)", monthNum: 12 },
];

const ALL_MONTHS = [
  { monthNum: 1, label: "Jan", fullLabel: "01월 (Jan)" },
  { monthNum: 2, label: "Feb", fullLabel: "02월 (Feb)" },
  { monthNum: 3, label: "Mar", fullLabel: "03월 (Mar)" },
  { monthNum: 4, label: "Apr", fullLabel: "04월 (Apr)" },
  { monthNum: 5, label: "May", fullLabel: "05월 (May)" },
  { monthNum: 6, label: "Jun", fullLabel: "06월 (Jun)" },
  { monthNum: 7, label: "Jul", fullLabel: "07월 (Jul)" },
  { monthNum: 8, label: "Aug", fullLabel: "08월 (Aug)" },
  { monthNum: 9, label: "Sep", fullLabel: "09월 (Sep)" },
  { monthNum: 10, label: "Oct", fullLabel: "10월 (Oct)" },
  { monthNum: 11, label: "Nov", fullLabel: "11월 (Nov)" },
  { monthNum: 12, label: "Dec", fullLabel: "12월 (Dec)" }
];

function parseDateParts(dateStr?: string | null) {
  if (!dateStr) return { year: "", month: "", day: "", monthNum: 0, raw: "" };
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) {
    const mNum = parseInt(match[2], 10);
    return {
      year: match[1],
      month: match[2].padStart(2, "0"),
      day: match[3].padStart(2, "0"),
      monthNum: mNum,
      raw: clean
    };
  }
  const yearMonthMatch = clean.match(/^(\d{4})[-./](\d{1,2})/);
  if (yearMonthMatch) {
    const mNum = parseInt(yearMonthMatch[2], 10);
    return {
      year: yearMonthMatch[1],
      month: yearMonthMatch[2].padStart(2, "0"),
      day: "",
      monthNum: mNum,
      raw: clean
    };
  }
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  return {
    year: yearMatch ? yearMatch[1] : "",
    month: "",
    day: "",
    monthNum: 0,
    raw: clean
  };
}

function getParamUnit(paramName: string): string {
  if (paramName.includes("부유입자")) {
    return "개/m³";
  }
  if (paramName === "부유균") {
    return "CFU/m³";
  }
  return "CFU/plate";
}

// Custom Tooltip for Recharts Line Chart
function CustomChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs border border-gray-700">
      <p className="font-bold text-gray-200 border-b border-gray-700 pb-1 mb-1.5">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-gray-300">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}:
          </span>
          <span className="font-mono font-bold text-white">
            {entry.value !== null && entry.value !== undefined
              ? `${entry.value} ${unit}`
              : "No Data"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const [measurements, setMeasurements] = useState<EMMeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period Filters
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Quick Trend Parameter Selector
  const [trendParameter, setTrendParameter] = useState<string>(PARAMETERS[0]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEMMeasurements();
      setMeasurements(data || []);
    } catch (e: any) {
      console.error("Failed to load dashboard stats:", e);
      setError(e?.message || "Failed to load EM records from Firestore.");
    } finally {
      setLoading(false);
    }
  };

  // Group measurements by room_name + measurement_date + document_id (identical to EM Data page)
  const groupedRooms: RoomGroup[] = useMemo(() => {
    const groups: Record<string, RoomGroup> = {};
    measurements.forEach((m) => {
      const key = `${m.document_id || "doc"}_${m.measurement_date || "nodate"}_${m.room_name || "noroom"}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          measurement_date: m.measurement_date || "",
          room_name: m.room_name || "",
          room_grade: m.room_grade || "",
          manual_grade: m.room_grade || "",
          parameters: {},
          source_page: m.source_page || null,
          conclusion: m.room_conclusion || "PASS",
          document_id: m.document_id,
        };
      }
      if (m.room_conclusion) {
        groups[key].conclusion = m.room_conclusion;
      }
      groups[key].parameters[m.parameter_name] = {
        id: m.measurement_id,
        measurement_date: m.measurement_date,
        room_name: m.room_name,
        room_grade: m.room_grade,
        parameter: m.parameter_name,
        result: m.result,
        unit: m.unit,
        alert_limit: m.alert_limit,
        action_limit: m.action_limit,
        status: m.calculated_status,
        manual_status: m.final_status,
        source_page: m.source_page,
        extraction_method: m.extraction_method,
      } as ExtractedRecord;
    });
    return Object.values(groups);
  }, [measurements]);

  // Extract distinct years from existing Firestore EM records
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    groupedRooms.forEach((r) => {
      const { year } = parseDateParts(r.measurement_date);
      if (year) years.add(year);
    });
    return Array.from(years).sort().reverse();
  }, [groupedRooms]);

  // Filter room records according to selected Year and Month
  const filteredRooms = useMemo(() => {
    return groupedRooms.filter((r) => {
      const { year, month } = parseDateParts(r.measurement_date);
      if (selectedYear && year !== selectedYear) return false;
      if (selectedMonth && month !== selectedMonth) return false;
      return true;
    });
  }, [groupedRooms, selectedYear, selectedMonth]);

  // Summary statistics calculation (room-level records, strictly matching EM Data)
  const totalEmRecords = filteredRooms.length;
  const uniqueRoomsMonitored = useMemo(() => {
    const rooms = new Set<string>();
    filteredRooms.forEach((r) => {
      if (r.room_name) rooms.add(r.room_name);
    });
    return rooms.size;
  }, [filteredRooms]);

  const passCount = useMemo(() => {
    return filteredRooms.filter((r) => (r.conclusion || "PASS").toUpperCase() === "PASS").length;
  }, [filteredRooms]);

  const alertCount = useMemo(() => {
    return filteredRooms.filter((r) => (r.conclusion || "").toUpperCase() === "ALERT").length;
  }, [filteredRooms]);

  const actionCount = useMemo(() => {
    return filteredRooms.filter((r) => (r.conclusion || "").toUpperCase() === "ACTION").length;
  }, [filteredRooms]);

  const oosCount = useMemo(() => {
    return filteredRooms.filter((r) => (r.conclusion || "").toUpperCase() === "OOS").length;
  }, [filteredRooms]);

  // Quick Monthly Trend aggregation reusing identical logic from TrendAnalysis
  const monthlyTrendData = useMemo(() => {
    // Filter raw measurements for selected trend parameter and selected Year
    const paramMeasurements = measurements.filter((m) => {
      if (m.parameter_name !== trendParameter) return false;
      const { year } = parseDateParts(m.measurement_date);
      if (selectedYear && year !== selectedYear) return false;
      return true;
    });

    return ALL_MONTHS.map((def) => {
      const monthRecords = paramMeasurements.filter((m) => {
        const { monthNum } = parseDateParts(m.measurement_date);
        return monthNum === def.monthNum;
      });

      const numericValues = monthRecords
        .map((m) => m.result)
        .filter((r): r is number => typeof r === "number" && !isNaN(r) && r !== null);

      let average: number | null = null;
      let max: number | null = null;

      if (numericValues.length > 0) {
        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        average = Math.round((sum / numericValues.length) * 100) / 100;
        max = Math.max(...numericValues);
      }

      return {
        monthNum: def.monthNum,
        label: def.label,
        measurementsCount: monthRecords.length,
        average,
        max,
      };
    });
  }, [measurements, trendParameter, selectedYear]);

  // Has any numeric data for monthly trend preview
  const hasTrendData = useMemo(() => {
    return monthlyTrendData.some((d) => d.average !== null || d.max !== null);
  }, [monthlyTrendData]);

  // Recent OOS Results: Latest ~5 OOS EM records from ALL 5 parameters
  const recentOosRecords = useMemo(() => {
    return measurements
      .filter((m) => {
        const status = (m.final_status || m.calculated_status || "").trim().toUpperCase();
        if (status !== "OOS") return false;

        const { year, month } = parseDateParts(m.measurement_date);
        if (selectedYear && year !== selectedYear) return false;
        if (selectedMonth && month !== selectedMonth) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = a.measurement_date || "";
        const dateB = b.measurement_date || "";
        return dateB.localeCompare(dateA);
      })
      .slice(0, 5);
  }, [measurements, selectedYear, selectedMonth]);

  // Microorganism Summary: Top 3-5 detected microorganisms with status = IDENTIFIED
  const topMicroorganisms = useMemo(() => {
    const counts: Record<string, number> = {};

    measurements.forEach((m) => {
      const idStatus = (m.microorganism_id_status || "").trim().toUpperCase();
      if (idStatus !== "IDENTIFIED") return;

      const { year, month } = parseDateParts(m.measurement_date);
      if (selectedYear && year !== selectedYear) return;
      if (selectedMonth && month !== selectedMonth) return;

      const names: string[] = [];
      if (Array.isArray(m.microorganism_names) && m.microorganism_names.length > 0) {
        m.microorganism_names.forEach((name) => {
          if (typeof name === "string" && name.trim()) {
            names.push(name.trim());
          }
        });
      } else if (m.microorganism_name && typeof m.microorganism_name === "string" && m.microorganism_name.trim()) {
        m.microorganism_name.split(",").forEach((name) => {
          if (name.trim()) names.push(name.trim());
        });
      }

      names.forEach((name) => {
        const upper = name.toUpperCase();
        if (
          upper === "NOT IDENTIFIED" ||
          upper === "NOT ENTERED" ||
          upper === "NONE" ||
          upper === "N/A"
        ) {
          return;
        }
        counts[name] = (counts[name] || 0) + 1;
      });
    });

    const list = Object.entries(counts).map(([name, count]) => ({
      name,
      count,
    }));

    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return list.slice(0, 5);
  }, [measurements, selectedYear, selectedMonth]);

  const totalIdentifiedOccurrences = useMemo(() => {
    return topMicroorganisms.reduce((acc, curr) => acc + curr.count, 0);
  }, [topMicroorganisms]);

  const handleResetFilters = () => {
    setSelectedYear("");
    setSelectedMonth("");
  };

  const hasActiveFilters = Boolean(selectedYear || selectedMonth);

  return (
    <div className="flex-1 flex flex-col space-y-6 min-w-0">
      {/* Top Header & Filter Bar Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-600" />
              Environmental Monitoring Dashboard
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Real-time cleanroom environmental monitoring compliance and excursion metrics.
            </p>
          </div>

          {/* Period Filters: Year & Month */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Year Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                Year:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="text-xs font-semibold text-gray-800 bg-transparent focus:outline-none cursor-pointer pr-2"
              >
                <option value="">All Years</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                Month:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-semibold text-gray-800 bg-transparent focus:outline-none cursor-pointer pr-2"
              >
                <option value="">All Months</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Reset Year and Month filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total EM Records */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Total EM Records
            </span>
            <Database className="w-4 h-4 text-gray-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-gray-900 font-mono">
              {loading ? "..." : totalEmRecords}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">records</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Room monitoring events</p>
        </div>

        {/* 2. Rooms Monitored */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Rooms Monitored
            </span>
            <Building2 className="w-4 h-4 text-gray-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-gray-900 font-mono">
              {loading ? "..." : uniqueRoomsMonitored}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">rooms</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Unique cleanroom areas</p>
        </div>

        {/* 3. PASS (Neutral / Black convention) */}
        <div className="bg-white p-4 rounded-xl border border-gray-300 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wider block">
              PASS
            </span>
            <CheckCircle2 className="w-4 h-4 text-gray-800" />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-gray-900 font-mono">
              {loading ? "..." : passCount}
            </span>
            <span className="text-[11px] text-gray-600 font-medium">records</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Within normal limits</p>
        </div>

        {/* 4. ALERT (Blue convention) */}
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
              ALERT
            </span>
            <AlertTriangle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-blue-700 font-mono">
              {loading ? "..." : alertCount}
            </span>
            <span className="text-[11px] text-blue-600 font-medium">records</span>
          </div>
          <p className="text-[10px] text-blue-600/80 mt-1">Alert limit exceeded</p>
        </div>

        {/* 5. ACTION (Green convention) */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
              ACTION
            </span>
            <AlertOctagon className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-emerald-700 font-mono">
              {loading ? "..." : actionCount}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">records</span>
          </div>
          <p className="text-[10px] text-emerald-600/80 mt-1">Action limit exceeded</p>
        </div>

        {/* 6. OOS (Red convention) */}
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider block">
              OOS
            </span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-red-700 font-mono">
              {loading ? "..." : oosCount}
            </span>
            <span className="text-[11px] text-red-600 font-medium">records</span>
          </div>
          <p className="text-[10px] text-red-600/80 mt-1">Out of specification</p>
        </div>
      </div>

      {/* Main Body: Either Empty State or Analytics Breakdown */}
      {filteredRooms.length === 0 && !loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-2xs">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
            <Activity className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-900">
            No Environmental Monitoring data available for the selected period.
          </h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
            {hasActiveFilters
              ? `There are no monitoring records registered for Year: ${selectedYear || "All"} and Month: ${selectedMonth ? MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label : "All"}.`
              : "No records found in Firestore. Import your Certificate of Analysis (CoA) PDFs to start monitoring."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            ) : (
              <Link
                to="/import"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors shadow-2xs"
              >
                <FileUp className="w-3.5 h-3.5" />
                Import PDF
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Monthly Trend Preview (Quick Trend) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                  <LineChartIcon className="w-4 h-4 text-orange-600" />
                  Monthly Trend Preview
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Monthly average and maximum curves across 12 monitoring cycles.
                  {selectedYear && ` (Filtered for ${selectedYear})`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Parameter Dropdown */}
                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                    Parameter:
                  </label>
                  <select
                    value={trendParameter}
                    onChange={(e) => setTrendParameter(e.target.value)}
                    className="text-xs font-semibold text-gray-800 bg-transparent focus:outline-none cursor-pointer pr-1"
                  >
                    {PARAMETERS.map((param) => (
                      <option key={param} value={param}>
                        {param}
                      </option>
                    ))}
                  </select>
                </div>

                {/* View Full Trend Analysis Link */}
                <Link
                  to="/trends"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200 transition-colors"
                >
                  View Full Trend Analysis
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Recharts Monthly Trend Graph */}
            <div className="mt-4">
              {!hasTrendData ? (
                <div className="py-12 text-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                  <TrendingUp className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
                  <p className="text-xs font-medium">No trend measurements available for {trendParameter} in the selected period.</p>
                </div>
              ) : (
                <div className="w-full h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={monthlyTrendData}
                      margin={{ top: 10, right: 25, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<CustomChartTooltip unit={getParamUnit(trendParameter)} />}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                        iconSize={10}
                      />
                      <Line
                        type="monotone"
                        dataKey="average"
                        name="Monthly Average"
                        stroke="#ea580c"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: "#ea580c" }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="max"
                        name="Monthly Maximum"
                        stroke="#2563eb"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3.5, fill: "#2563eb" }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2 & 3: Two Columns (Recent OOS Results & Microorganism Summary) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Recent OOS Results (All 5 parameters) */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      Recent OOS Results
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Latest out-of-specification events across all 5 monitoring parameters.
                    </p>
                  </div>
                  <Link
                    to="/oos"
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 uppercase tracking-wider flex items-center gap-1"
                  >
                    View All
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Date</th>
                        <th scope="col" className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Room</th>
                        <th scope="col" className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Parameter</th>
                        <th scope="col" className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px] text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {recentOosRecords.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                            No OOS records detected for the selected period.
                          </td>
                        </tr>
                      ) : (
                        recentOosRecords.map((m) => (
                          <tr key={m.measurement_id} className="hover:bg-red-50/40 transition-colors">
                            <td className="px-3 py-2 text-gray-600 font-mono whitespace-nowrap">
                              {m.measurement_date || "-"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-gray-900 truncate max-w-[130px]" title={m.room_name || ""}>
                                  {m.room_name || "-"}
                                </span>
                                {m.room_grade && (
                                  <span className="text-[9px] px-1 py-0.2 bg-gray-100 text-gray-600 rounded font-semibold border border-gray-200">
                                    Gr {m.room_grade}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-700 font-medium truncate max-w-[120px]" title={m.parameter_name}>
                              {m.parameter_name}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-red-700 whitespace-nowrap">
                              {m.result !== null && m.result !== undefined ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-700 rounded border border-red-200">
                                  {m.result} {m.unit || ""}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="text-[11px]">
                  Total OOS in period: <strong className="text-red-700">{oosCount}</strong>
                </span>
                <Link
                  to="/oos"
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1"
                >
                  Manage OOS in Microbiology
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Column: Microorganism Summary (Top 3-5 Identified Organisms) */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                      <Bug className="w-4 h-4 text-orange-600" />
                      Most Frequently Detected Microorganisms
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Top identified species from laboratory identification records.
                    </p>
                  </div>
                  <Link
                    to="/oos?tab=microorganism"
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 uppercase tracking-wider flex items-center gap-1"
                  >
                    Analysis
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px]">
                          Microorganism
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px] text-right">
                          Occurrences
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {topMicroorganisms.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-4 py-8 text-center text-gray-400 italic">
                            <Bug className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                            No identified microorganisms recorded for the selected period.
                          </td>
                        </tr>
                      ) : (
                        topMicroorganisms.map((org, index) => {
                          const percentage = totalIdentifiedOccurrences > 0
                            ? Math.round((org.count / totalIdentifiedOccurrences) * 100)
                            : 0;

                          return (
                            <tr key={org.name} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center text-[10px] font-bold">
                                    {index + 1}
                                  </span>
                                  <span className="font-semibold text-gray-900 italic">
                                    {org.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                    <div
                                      className="bg-orange-500 h-full rounded-full"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-[11px]">
                                    {org.count}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  Total identified: <strong className="text-gray-900">{totalIdentifiedOccurrences}</strong>
                </span>
                <Link
                  to="/oos?tab=microorganism"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors shadow-2xs"
                >
                  <Bug className="w-3.5 h-3.5" />
                  View Microorganism Analysis
                </Link>
              </div>
            </div>
          </div>

          {/* Cleanroom Compliance Distribution Bar & Quick Module Links */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                <Layers className="w-4 h-4 text-orange-600" />
                Cleanroom Compliance Distribution
              </h3>
              <span className="text-xs text-gray-500 font-mono">
                {totalEmRecords} total room event{totalEmRecords === 1 ? "" : "s"}
              </span>
            </div>

            {totalEmRecords > 0 && (
              <div className="space-y-2 mb-6">
                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                  {passCount > 0 && (
                    <div
                      style={{ width: `${(passCount / totalEmRecords) * 100}%` }}
                      className="bg-gray-800 transition-all"
                      title={`PASS: ${passCount} (${((passCount / totalEmRecords) * 100).toFixed(1)}%)`}
                    />
                  )}
                  {alertCount > 0 && (
                    <div
                      style={{ width: `${(alertCount / totalEmRecords) * 100}%` }}
                      className="bg-blue-500 transition-all"
                      title={`ALERT: ${alertCount} (${((alertCount / totalEmRecords) * 100).toFixed(1)}%)`}
                    />
                  )}
                  {actionCount > 0 && (
                    <div
                      style={{ width: `${(actionCount / totalEmRecords) * 100}%` }}
                      className="bg-emerald-500 transition-all"
                      title={`ACTION: ${actionCount} (${((actionCount / totalEmRecords) * 100).toFixed(1)}%)`}
                    />
                  )}
                  {oosCount > 0 && (
                    <div
                      style={{ width: `${(oosCount / totalEmRecords) * 100}%` }}
                      className="bg-red-600 transition-all"
                      title={`OOS: ${oosCount} (${((oosCount / totalEmRecords) * 100).toFixed(1)}%)`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-gray-800"></span>
                    <span>PASS: <strong className="text-gray-900">{passCount}</strong> ({totalEmRecords > 0 ? ((passCount / totalEmRecords) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span>ALERT: <strong className="text-blue-700">{alertCount}</strong> ({totalEmRecords > 0 ? ((alertCount / totalEmRecords) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span>ACTION: <strong className="text-emerald-700">{actionCount}</strong> ({totalEmRecords > 0 ? ((actionCount / totalEmRecords) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-600"></span>
                    <span>OOS: <strong className="text-red-700">{oosCount}</strong> ({totalEmRecords > 0 ? ((oosCount / totalEmRecords) * 100).toFixed(1) : 0}%)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Fast Module Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <Link
                to="/data"
                className="p-3.5 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-lg transition-colors group block"
              >
                <div className="flex items-center justify-between text-gray-900 font-bold text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-orange-600" />
                    EM Database
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-gray-500">
                  Review, filter, edit, and export validated EM records.
                </p>
              </Link>

              <Link
                to="/trends"
                className="p-3.5 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-lg transition-colors group block"
              >
                <div className="flex items-center justify-between text-gray-900 font-bold text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
                    Trend Analysis
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-gray-500">
                  Interactive charts, monthly distributions, and limit lines.
                </p>
              </Link>

              <Link
                to="/oos"
                className="p-3.5 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-lg transition-colors group block"
              >
                <div className="flex items-center justify-between text-gray-900 font-bold text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    OOS & Microorganism
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-gray-500">
                  Track non-conformances and laboratory identifications.
                </p>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
