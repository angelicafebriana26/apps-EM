import React, { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  Database,
  Filter,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Calendar,
  Info,
  ShieldAlert,
  X
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from "recharts";
import { getEMMeasurements, EMMeasurementRecord } from "../services/emDatabaseService";
import { emCriteriaMaster, CriteriaLimit } from "../lib/emCriteriaConfig";

const PARAMETERS = [
  "부유입자 ≥0.5 μm",
  "부유입자 ≥5.0 μm",
  "부유균",
  "낙하균",
  "표면균"
];

const GRADES = ["A", "B", "C", "D"];

const MONTHS_FILTER = [
  { value: 1, label: "01 (Jan)" },
  { value: 2, label: "02 (Feb)" },
  { value: 3, label: "03 (Mar)" },
  { value: 4, label: "04 (Apr)" },
  { value: 5, label: "05 (May)" },
  { value: 6, label: "06 (Jun)" },
  { value: 7, label: "07 (Jul)" },
  { value: 8, label: "08 (Aug)" },
  { value: 9, label: "09 (Sep)" },
  { value: 10, label: "10 (Oct)" },
  { value: 11, label: "11 (Nov)" },
  { value: 12, label: "12 (Dec)" }
];

interface MonthDefinition {
  monthNum: number;
  label: string;
  fullLabel: string;
}

const ALL_MONTHS: MonthDefinition[] = [
  { monthNum: 1, label: "Jan", fullLabel: "Jan (01월)" },
  { monthNum: 2, label: "Feb", fullLabel: "Feb (02월)" },
  { monthNum: 3, label: "Mar", fullLabel: "Mar (03월)" },
  { monthNum: 4, label: "Apr", fullLabel: "Apr (04월)" },
  { monthNum: 5, label: "May", fullLabel: "May (05월)" },
  { monthNum: 6, label: "Jun", fullLabel: "Jun (06월)" },
  { monthNum: 7, label: "Jul", fullLabel: "Jul (07월)" },
  { monthNum: 8, label: "Aug", fullLabel: "Aug (08월)" },
  { monthNum: 9, label: "Sep", fullLabel: "Sep (09월)" },
  { monthNum: 10, label: "Oct", fullLabel: "Oct (10월)" },
  { monthNum: 11, label: "Nov", fullLabel: "Nov (11월)" },
  { monthNum: 12, label: "Dec", fullLabel: "Dec (12월)" }
];

function parseDateParts(dateStr?: string | null) {
  if (!dateStr) return { year: null, month: null, day: null };
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) {
    return {
      year: match[1],
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10)
    };
  }
  const yearMonthMatch = clean.match(/^(\d{4})[-./](\d{1,2})/);
  if (yearMonthMatch) {
    return {
      year: yearMonthMatch[1],
      month: parseInt(yearMonthMatch[2], 10),
      day: null
    };
  }
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  return {
    year: yearMatch ? yearMatch[1] : null,
    month: null,
    day: null
  };
}

export function TrendAnalysis() {
  const [measurements, setMeasurements] = useState<EMMeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter input state (pending user clicking "Apply Filters")
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedParameter, setSelectedParameter] = useState<string>("");
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [fromMonth, setFromMonth] = useState<string>("");
  const [toMonth, setToMonth] = useState<string>("");

  // Mode: 'ALL' or 'EXCURSIONS'
  const [displayMode, setDisplayMode] = useState<"ALL" | "EXCURSIONS">("ALL");

  // Chart line visibility checkboxes / toggles
  const [showAverage, setShowAverage] = useState<boolean>(true);
  const [showMaximum, setShowMaximum] = useState<boolean>(true);
  const [showAlertLine, setShowAlertLine] = useState<boolean>(true);
  const [showActionLine, setShowActionLine] = useState<boolean>(true);
  const [showAcceptanceLine, setShowAcceptanceLine] = useState<boolean>(true);

  // Selected excursion for detailed modal/popup inspection
  const [selectedExcursion, setSelectedExcursion] = useState<EMMeasurementRecord | null>(null);

  // Applied filter state (used for querying/filtering results)
  const [appliedFilters, setAppliedFilters] = useState({
    year: "",
    parameter: "",
    room: "all",
    grade: "all",
    fromMonth: "",
    toMonth: "",
    isApplied: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEMMeasurements();
      setMeasurements(data || []);

      // Auto-apply initial state
      setAppliedFilters({
        year: "",
        parameter: "",
        room: "all",
        grade: "all",
        fromMonth: "",
        toMonth: "",
        isApplied: true
      });
    } catch (err: any) {
      console.error("Failed to load EM measurements for trend analysis:", err);
      setError(err?.message || "Failed to load Environmental Monitoring records from Firestore.");
    } finally {
      setLoading(false);
    }
  };

  // Extract distinct available Years and Rooms from Firestore data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    measurements.forEach((m) => {
      const { year } = parseDateParts(m.measurement_date);
      if (year) years.add(year);
    });
    return Array.from(years).sort().reverse();
  }, [measurements]);

  const availableRooms = useMemo(() => {
    const rooms = new Set<string>();
    measurements.forEach((m) => {
      if (m.room_name && m.room_name.trim()) {
        rooms.add(m.room_name.trim());
      }
    });
    return Array.from(rooms).sort();
  }, [measurements]);

  // Apply filters action
  const handleApplyFilters = () => {
    setAppliedFilters({
      year: selectedYear,
      parameter: selectedParameter,
      room: selectedRoom,
      grade: selectedGrade,
      fromMonth: fromMonth,
      toMonth: toMonth,
      isApplied: true
    });
  };

  // Reset filters action
  const handleResetFilters = () => {
    setSelectedYear("");
    setSelectedParameter("");
    setSelectedRoom("all");
    setSelectedGrade("all");
    setFromMonth("");
    setToMonth("");
    setDisplayMode("ALL");

    setAppliedFilters({
      year: "",
      parameter: "",
      room: "all",
      grade: "all",
      fromMonth: "",
      toMonth: "",
      isApplied: true
    });
  };

  // Active Criteria Limits from centralized EM criteria engine
  const activeCriteriaLimits: CriteriaLimit | null = useMemo(() => {
    if (!appliedFilters.grade || appliedFilters.grade === "all") return null;
    if (!appliedFilters.parameter) return null;

    const gradeRules = emCriteriaMaster[appliedFilters.grade];
    if (!gradeRules) return null;

    return gradeRules[appliedFilters.parameter] || null;
  }, [appliedFilters.grade, appliedFilters.parameter]);

  // Filter the measurements according to the applied criteria and displayMode
  const baseFilteredMeasurements = useMemo(() => {
    if (!appliedFilters.isApplied) return measurements;

    return measurements.filter((m) => {
      const { year, month } = parseDateParts(m.measurement_date);

      // Year Filter
      if (appliedFilters.year && year !== appliedFilters.year) {
        return false;
      }

      // Parameter Filter
      if (appliedFilters.parameter && m.parameter_name !== appliedFilters.parameter) {
        return false;
      }

      // Room Filter
      if (appliedFilters.room && appliedFilters.room !== "all") {
        if (m.room_name?.trim() !== appliedFilters.room) {
          return false;
        }
      }

      // Grade Filter
      if (appliedFilters.grade && appliedFilters.grade !== "all") {
        const itemGrade = (m.room_grade || "").trim().toUpperCase();
        if (itemGrade !== appliedFilters.grade.toUpperCase()) {
          return false;
        }
      }

      // Month Range Filter
      const fromM = appliedFilters.fromMonth ? parseInt(appliedFilters.fromMonth, 10) : null;
      const toM = appliedFilters.toMonth ? parseInt(appliedFilters.toMonth, 10) : null;

      if (fromM !== null && month !== null && month < fromM) {
        return false;
      }
      if (toM !== null && month !== null && month > toM) {
        return false;
      }
      // If month is missing and month range is specified
      if ((fromM !== null || toM !== null) && month === null) {
        return false;
      }

      return true;
    });
  }, [measurements, appliedFilters]);

  // Measurements taking Display Mode ('ALL' vs 'EXCURSIONS') into account
  const filteredMeasurements = useMemo(() => {
    if (displayMode === "EXCURSIONS") {
      return baseFilteredMeasurements.filter((m) => {
        const st = (m.final_status || m.calculated_status || "").toUpperCase();
        return st === "ALERT" || st === "ACTION" || st === "OOS";
      });
    }
    return baseFilteredMeasurements;
  }, [baseFilteredMeasurements, displayMode]);

  // List of all excursions in the current base filtered set
  const allExcursionRecords = useMemo(() => {
    return baseFilteredMeasurements.filter((m) => {
      const st = (m.final_status || m.calculated_status || "").toUpperCase();
      return st === "ALERT" || st === "ACTION" || st === "OOS";
    });
  }, [baseFilteredMeasurements]);

  // Helper to look up criteria for any record (fallback to master criteria engine if record limits are null)
  const getRecordLimits = (rec: EMMeasurementRecord) => {
    const g = (rec.room_grade || "").trim().toUpperCase();
    const p = (rec.parameter_name || "").trim();
    const masterLimit = (g && p && emCriteriaMaster[g]) ? emCriteriaMaster[g][p] : null;

    return {
      alert: rec.alert_limit ?? masterLimit?.alert ?? null,
      action: rec.action_limit ?? masterLimit?.action ?? null,
      acceptance: rec.acceptance_criteria ?? masterLimit?.acceptance ?? null
    };
  };

  // Group measurements by month and calculate monthly statistics
  const monthlyStats = useMemo(() => {
    return ALL_MONTHS.map((def) => {
      const monthRecords = filteredMeasurements.filter((m) => {
        const { month } = parseDateParts(m.measurement_date);
        return month === def.monthNum;
      });

      const measurementsCount = monthRecords.length;

      // Extract valid numeric results, strictly excluding null/undefined/NaN, including explicit 0
      const numericValues = monthRecords
        .map((m) => m.result)
        .filter((r): r is number => typeof r === "number" && !isNaN(r) && r !== null);

      let average: number | null = null;
      let min: number | null = null;
      let max: number | null = null;

      if (numericValues.length > 0) {
        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        average = Math.round((sum / numericValues.length) * 100) / 100;
        min = Math.min(...numericValues);
        max = Math.max(...numericValues);
      }

      // Status counts based on existing final reviewed status stored in Firestore
      const passCount = monthRecords.filter(
        (m) => (m.final_status || m.calculated_status || "").toUpperCase() === "PASS"
      ).length;
      const alertCount = monthRecords.filter(
        (m) => (m.final_status || m.calculated_status || "").toUpperCase() === "ALERT"
      ).length;
      const actionCount = monthRecords.filter(
        (m) => (m.final_status || m.calculated_status || "").toUpperCase() === "ACTION"
      ).length;
      const oosCount = monthRecords.filter(
        (m) => (m.final_status || m.calculated_status || "").toUpperCase() === "OOS"
      ).length;

      // Month specific excursions
      const monthExcursions = monthRecords.filter((m) => {
        const st = (m.final_status || m.calculated_status || "").toUpperCase();
        return st === "ALERT" || st === "ACTION" || st === "OOS";
      });

      return {
        monthNum: def.monthNum,
        label: def.label,
        fullLabel: def.fullLabel,
        measurements: measurementsCount,
        numericCount: numericValues.length,
        average,
        min,
        max,
        passCount,
        alertCount,
        actionCount,
        oosCount,
        excursions: monthExcursions
      };
    });
  }, [filteredMeasurements]);

  // Overall totals across all months
  const totalSummary = useMemo(() => {
    const totalMeasurements = filteredMeasurements.length;
    const allNumeric = filteredMeasurements
      .map((m) => m.result)
      .filter((r): r is number => typeof r === "number" && !isNaN(r) && r !== null);

    let average: number | null = null;
    let min: number | null = null;
    let max: number | null = null;

    if (allNumeric.length > 0) {
      const sum = allNumeric.reduce((acc, val) => acc + val, 0);
      average = Math.round((sum / allNumeric.length) * 100) / 100;
      min = Math.min(...allNumeric);
      max = Math.max(...allNumeric);
    }

    const passCount = filteredMeasurements.filter(
      (m) => (m.final_status || m.calculated_status || "").toUpperCase() === "PASS"
    ).length;
    const alertCount = filteredMeasurements.filter(
      (m) => (m.final_status || m.calculated_status || "").toUpperCase() === "ALERT"
    ).length;
    const actionCount = filteredMeasurements.filter(
      (m) => (m.final_status || m.calculated_status || "").toUpperCase() === "ACTION"
    ).length;
    const oosCount = filteredMeasurements.filter(
      (m) => (m.final_status || m.calculated_status || "").toUpperCase() === "OOS"
    ).length;

    return {
      measurements: totalMeasurements,
      average,
      min,
      max,
      passCount,
      alertCount,
      actionCount,
      oosCount
    };
  }, [filteredMeasurements]);

  // Status visual badge styling helper
  // PASS = black / neutral, ALERT = blue, ACTION = green, OOS = red
  const getStatusBadge = (status: string | null) => {
    const st = (status || "").toUpperCase();
    switch (st) {
      case "PASS":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-black border border-gray-300">
            PASS
          </span>
        );
      case "ALERT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
            ALERT
          </span>
        );
      case "ACTION":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-200">
            ACTION
          </span>
        );
      case "OOS":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
            OOS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
            {status || "UNKNOWN"}
          </span>
        );
    }
  };

  // Custom Tooltip for Recharts LineChart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data || data.measurements === 0) {
        return (
          <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-xs">
            <p className="font-bold text-gray-800">{data?.fullLabel || label}</p>
            <p className="text-gray-400 italic mt-1">No measurements recorded</p>
          </div>
        );
      }
      return (
        <div className="bg-white p-3.5 rounded-lg shadow-xl border border-gray-200 text-xs min-w-[210px] space-y-2 z-50">
          <div className="border-b border-gray-100 pb-1.5 flex items-center justify-between">
            <span className="font-bold text-gray-800">{data.fullLabel}</span>
            <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
              {data.measurements} record{data.measurements > 1 ? "s" : ""}
            </span>
          </div>

          {data.average !== null && (
            <div className="flex items-center justify-between gap-3 text-orange-700 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                Monthly Average:
              </span>
              <span className="font-mono font-bold">{data.average}</span>
            </div>
          )}

          {data.max !== null && (
            <div className="flex items-center justify-between gap-3 text-blue-700 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                Monthly Maximum:
              </span>
              <span className="font-mono font-bold">{data.max}</span>
            </div>
          )}

          {data.min !== null && (
            <div className="flex items-center justify-between gap-3 text-gray-600">
              <span className="text-gray-400">Monthly Minimum:</span>
              <span className="font-mono font-semibold text-gray-700">{data.min}</span>
            </div>
          )}

          {/* Active Criteria Reference Info in Tooltip if enabled */}
          {activeCriteriaLimits && (
            <div className="pt-1.5 border-t border-gray-100 space-y-1 text-[11px] bg-gray-50 p-2 rounded">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                Grade {appliedFilters.grade} Criteria
              </div>
              <div className="flex justify-between text-blue-600">
                <span>Alert Limit:</span>
                <span className="font-mono font-bold">{activeCriteriaLimits.alert ?? "N/A"}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Action Limit:</span>
                <span className="font-mono font-bold">{activeCriteriaLimits.action ?? "N/A"}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Acceptance (OOS):</span>
                <span className="font-mono font-bold">{activeCriteriaLimits.acceptance ?? "N/A"}</span>
              </div>
            </div>
          )}

          {/* Status Breakdown */}
          <div className="pt-1.5 border-t border-gray-100 grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
            <span className="bg-gray-100 text-black border border-gray-300 rounded px-1 py-0.5" title="PASS (Black)">
              P: {data.passCount}
            </span>
            <span className="bg-blue-50 text-blue-600 border border-blue-200 rounded px-1 py-0.5" title="ALERT (Blue)">
              AL: {data.alertCount}
            </span>
            <span className="bg-green-50 text-green-600 border border-green-200 rounded px-1 py-0.5" title="ACTION (Green)">
              AC: {data.actionCount}
            </span>
            <span className="bg-red-50 text-red-600 border border-red-200 rounded px-1 py-0.5" title="OOS (Red)">
              OOS: {data.oosCount}
            </span>
          </div>

          {/* Monthly Excursion Count Notice */}
          {data.excursions && data.excursions.length > 0 && (
            <div className="text-[10px] text-red-700 bg-red-50/80 border border-red-200 rounded p-1.5 text-center font-bold flex items-center justify-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              {data.excursions.length} Excursion{data.excursions.length > 1 ? "s" : ""} Recorded
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header & Description */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5 mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Trend Analysis
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Query historical Environmental Monitoring data from Firestore by Year, Parameter, Room, Grade, and Month Range.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle: SHOW ALL vs EXCURSIONS ONLY */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-bold shadow-xs">
              <button
                type="button"
                onClick={() => setDisplayMode("ALL")}
                className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  displayMode === "ALL"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                SHOW ALL
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("EXCURSIONS")}
                className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  displayMode === "EXCURSIONS"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-red-700 hover:text-red-800"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                EXCURSIONS ONLY
                {allExcursionRecords.length > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                      displayMode === "EXCURSIONS"
                        ? "bg-white/20 text-white"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {allExcursionRecords.length}
                  </span>
                )}
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold text-gray-600">
              <Database className="w-3.5 h-3.5 text-orange-500" />
              Total in DB: {loading ? "..." : measurements.length}
            </span>
          </div>
        </div>

        {/* Filters Configuration */}
        <div>
          <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4 text-xs uppercase tracking-wider">
            <span className="w-2 h-3.5 bg-orange-500 rounded-full"></span>
            Filter Criteria
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Year Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full rounded border border-gray-200 py-2 pl-3 pr-8 text-xs focus:border-orange-500 focus:ring-orange-500 bg-white"
              >
                <option value="">All Years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Parameter Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Parameter
              </label>
              <select
                value={selectedParameter}
                onChange={(e) => setSelectedParameter(e.target.value)}
                className="block w-full rounded border border-gray-200 py-2 pl-3 pr-8 text-xs focus:border-orange-500 focus:ring-orange-500 bg-white truncate"
              >
                <option value="">All Parameters</option>
                {PARAMETERS.map((param) => (
                  <option key={param} value={param}>
                    {param}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Room
              </label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="block w-full rounded border border-gray-200 py-2 pl-3 pr-8 text-xs focus:border-orange-500 focus:ring-orange-500 bg-white truncate"
              >
                <option value="all">All Rooms</option>
                {availableRooms.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Grade
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="block w-full rounded border border-gray-200 py-2 pl-3 pr-8 text-xs focus:border-orange-500 focus:ring-orange-500 bg-white"
              >
                <option value="all">All Grades</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Range: From Month */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                From Month
              </label>
              <select
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                className="block w-full rounded border border-gray-200 py-2 pl-3 pr-8 text-xs focus:border-orange-500 focus:ring-orange-500 bg-white"
              >
                <option value="">From (Any)</option>
                {MONTHS_FILTER.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Range: To Month */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                To Month
              </label>
              <select
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                className="block w-full rounded border border-gray-200 py-2 pl-3 pr-8 text-xs focus:border-orange-500 focus:ring-orange-500 bg-white"
              >
                <option value="">To (Any)</option>
                {MONTHS_FILTER.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Controls: Apply Filters & Reset */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              {displayMode === "EXCURSIONS" ? (
                <span className="font-semibold text-red-600 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Showing only ALERT, ACTION, and OOS excursions
                </span>
              ) : (
                <span>Showing all recorded measurements</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-colors cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="font-bold underline uppercase text-[10px] cursor-pointer">
            Retry Loading
          </button>
        </div>
      )}

      {/* Matching Measurements and Trend Analysis Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            <h3 className="font-bold text-gray-700">
              Monthly Trend & Summary
            </h3>
            {displayMode === "EXCURSIONS" && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Excursions Filter Active
              </span>
            )}
          </div>

          {!loading && appliedFilters.isApplied && (
            <span className="text-xs font-semibold text-gray-500">
              {filteredMeasurements.length > 0 ? (
                <span className="text-orange-600 font-bold">
                  {filteredMeasurements.length} {displayMode === "EXCURSIONS" ? "excursions" : "measurements"} found
                </span>
              ) : (
                <span className="text-gray-400">0 records</span>
              )}
            </span>
          )}
        </div>

        <div className="p-6 flex-1 flex flex-col justify-center">
          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="mx-auto h-8 w-8 text-orange-500 mb-3 animate-spin" />
              <p className="text-sm font-semibold text-gray-500">Querying Firestore database...</p>
            </div>
          ) : filteredMeasurements.length === 0 ? (
            <div className="bg-gray-50/70 border border-dashed border-gray-200 rounded-xl p-12 text-center my-4 max-w-2xl mx-auto w-full">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-gray-700 mb-1">
                {displayMode === "EXCURSIONS"
                  ? "No excursion events (ALERT / ACTION / OOS) found for the selected criteria."
                  : "No Environmental Monitoring data available for the selected filters."}
              </h4>
              <p className="text-xs text-gray-400 mb-4">
                Try adjusting or resetting your filter criteria to inspect other parameters, rooms, or date ranges.
              </p>
              <div className="flex justify-center gap-3">
                {displayMode === "EXCURSIONS" && (
                  <button
                    type="button"
                    onClick={() => setDisplayMode("ALL")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer shadow-xs"
                  >
                    View All Records
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Filters
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Prominent Matching Count Card */}
              <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900 tracking-tight">
                      {filteredMeasurements.length} {displayMode === "EXCURSIONS" ? "excursion events" : "measurements"} found
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Matched from Environmental Monitoring database in Firestore based on active criteria.
                    </p>
                  </div>
                </div>

                {/* Applied Summary Tags */}
                <div className="flex flex-wrap gap-1.5 justify-end text-[11px]">
                  {appliedFilters.year && (
                    <span className="px-2.5 py-1 bg-white border border-orange-200 rounded text-orange-800 font-medium">
                      Year: {appliedFilters.year}
                    </span>
                  )}
                  {appliedFilters.parameter && (
                    <span className="px-2.5 py-1 bg-white border border-orange-200 rounded text-orange-800 font-medium truncate max-w-[150px]">
                      {appliedFilters.parameter}
                    </span>
                  )}
                  {appliedFilters.room !== "all" && (
                    <span className="px-2.5 py-1 bg-white border border-orange-200 rounded text-orange-800 font-medium">
                      Room: {appliedFilters.room}
                    </span>
                  )}
                  {appliedFilters.grade !== "all" && (
                    <span className="px-2.5 py-1 bg-white border border-orange-200 rounded text-orange-800 font-medium">
                      Grade {appliedFilters.grade}
                    </span>
                  )}
                  {(appliedFilters.fromMonth || appliedFilters.toMonth) && (
                    <span className="px-2.5 py-1 bg-white border border-orange-200 rounded text-orange-800 font-medium">
                      Month: {appliedFilters.fromMonth ? `${appliedFilters.fromMonth}월` : "1월"} ~{" "}
                      {appliedFilters.toMonth ? `${appliedFilters.toMonth}월` : "12월"}
                    </span>
                  )}
                  {displayMode === "EXCURSIONS" && (
                    <span className="px-2.5 py-1 bg-red-100 border border-red-300 rounded text-red-800 font-bold">
                      Excursions Only
                    </span>
                  )}
                </div>
              </div>

              {/* Threshold & Criteria Information Banner */}
              {appliedFilters.grade === "all" ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-950">Multiple Cleanliness Grades Selected</div>
                    <p className="mt-0.5 text-amber-800 leading-relaxed">
                      Multiple cleanliness grades are included. Alert, Action, and Acceptance limits vary by grade. Select a specific Grade to display threshold lines.
                    </p>
                  </div>
                </div>
              ) : !appliedFilters.parameter ? (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-blue-950">Select a Specific Parameter to View Thresholds</div>
                    <p className="mt-0.5 text-blue-800">
                      Grade {appliedFilters.grade} is selected. Select a specific Parameter from the filter to display Alert, Action, and Acceptance reference lines.
                    </p>
                  </div>
                </div>
              ) : activeCriteriaLimits ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-4 bg-indigo-600 rounded-full"></div>
                      <div>
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                          Centralized EM Criteria Limits
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          (Grade {appliedFilters.grade} • {appliedFilters.parameter})
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {/* Alert Limit */}
                      <div className="flex items-center gap-1.5 font-semibold text-blue-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                        <span>Alert Level:</span>
                        <span className="font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-blue-700">
                          {activeCriteriaLimits.alert !== null ? activeCriteriaLimits.alert : "N/A"}
                        </span>
                      </div>

                      {/* Action Limit */}
                      <div className="flex items-center gap-1.5 font-semibold text-green-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
                        <span>Action Level:</span>
                        <span className="font-mono font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200 text-green-700">
                          {activeCriteriaLimits.action !== null ? activeCriteriaLimits.action : "N/A"}
                        </span>
                      </div>

                      {/* Acceptance Criteria / OOS */}
                      <div className="flex items-center gap-1.5 font-semibold text-red-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                        <span>Acceptance Limit:</span>
                        <span className="font-mono font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200 text-red-700">
                          {activeCriteriaLimits.acceptance !== null ? activeCriteriaLimits.acceptance : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Monthly Line Chart Section */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-orange-500" />
                    <span className="font-bold text-sm text-gray-800">
                      Monthly Trend Curve (Jan – Dec)
                    </span>
                  </div>

                  {/* Chart Checkboxes / Toggles */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <label className="inline-flex items-center gap-1.5 font-semibold text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showAverage}
                        onChange={(e) => setShowAverage(e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-1 bg-orange-500 rounded"></span>
                        Monthly Average
                      </span>
                    </label>

                    <label className="inline-flex items-center gap-1.5 font-semibold text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showMaximum}
                        onChange={(e) => setShowMaximum(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-1 bg-blue-600 rounded border-dashed"></span>
                        Monthly Maximum
                      </span>
                    </label>

                    {/* Criteria Reference Line Toggles (Visible when specific criteria is active) */}
                    {activeCriteriaLimits && (
                      <>
                        <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>

                        {activeCriteriaLimits.alert !== null && (
                          <label className="inline-flex items-center gap-1.5 font-semibold text-blue-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={showAlertLine}
                              onChange={(e) => setShowAlertLine(e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-0.5 bg-blue-600 border-dashed"></span>
                              Alert ({activeCriteriaLimits.alert})
                            </span>
                          </label>
                        )}

                        {activeCriteriaLimits.action !== null && (
                          <label className="inline-flex items-center gap-1.5 font-semibold text-green-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={showActionLine}
                              onChange={(e) => setShowActionLine(e.target.checked)}
                              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                            />
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-0.5 bg-green-600 border-dashed"></span>
                              Action ({activeCriteriaLimits.action})
                            </span>
                          </label>
                        )}

                        {activeCriteriaLimits.acceptance !== null && (
                          <label className="inline-flex items-center gap-1.5 font-semibold text-red-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={showAcceptanceLine}
                              onChange={(e) => setShowAcceptanceLine(e.target.checked)}
                              className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                            />
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-0.5 bg-red-600"></span>
                              Acceptance ({activeCriteriaLimits.acceptance})
                            </span>
                          </label>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Recharts Chart Component */}
                <div className="w-full h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={monthlyStats}
                      margin={{ top: 15, right: 35, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tick={{ fill: "#6b7280", fontSize: 11, fontWeight: 500 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                        allowDecimals={true}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ paddingBottom: 10, fontSize: "11px", fontWeight: 600 }}
                      />

                      {/* Centralized EM Criteria Reference Lines */}
                      {activeCriteriaLimits && showAlertLine && activeCriteriaLimits.alert !== null && (
                        <ReferenceLine
                          y={activeCriteriaLimits.alert}
                          stroke="#2563eb"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `Alert (${activeCriteriaLimits.alert})`,
                            position: "insideTopRight",
                            fill: "#2563eb",
                            fontSize: 10,
                            fontWeight: 700
                          }}
                        />
                      )}

                      {activeCriteriaLimits && showActionLine && activeCriteriaLimits.action !== null && (
                        <ReferenceLine
                          y={activeCriteriaLimits.action}
                          stroke="#16a34a"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `Action (${activeCriteriaLimits.action})`,
                            position: "insideTopRight",
                            fill: "#16a34a",
                            fontSize: 10,
                            fontWeight: 700
                          }}
                        />
                      )}

                      {activeCriteriaLimits && showAcceptanceLine && activeCriteriaLimits.acceptance !== null && (
                        <ReferenceLine
                          y={activeCriteriaLimits.acceptance}
                          stroke="#dc2626"
                          strokeWidth={2}
                          label={{
                            value: `Acceptance Limit (${activeCriteriaLimits.acceptance})`,
                            position: "insideTopRight",
                            fill: "#dc2626",
                            fontSize: 10,
                            fontWeight: 700
                          }}
                        />
                      )}

                      {/* Main Trend Lines */}
                      {showAverage && (
                        <Line
                          type="monotone"
                          dataKey="average"
                          name="Monthly Average"
                          stroke="#ea580c"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#ea580c", strokeWidth: 1.5, stroke: "#ffffff" }}
                          activeDot={{ r: 6, fill: "#ea580c", strokeWidth: 2, stroke: "#ffffff" }}
                          connectNulls={false}
                        />
                      )}
                      {showMaximum && (
                        <Line
                          type="monotone"
                          dataKey="max"
                          name="Monthly Maximum"
                          stroke="#2563eb"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={{ r: 4, fill: "#2563eb", strokeWidth: 1.5, stroke: "#ffffff" }}
                          activeDot={{ r: 6, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                          connectNulls={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Excursion Events Section */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-gray-50/70 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <h4 className="font-bold text-xs text-gray-800 uppercase tracking-wider">
                      Excursion Events (ALERT / ACTION / OOS)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                      {allExcursionRecords.length} event{allExcursionRecords.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    Click any excursion record to view detailed criteria and limits
                  </span>
                </div>

                {allExcursionRecords.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-gray-600">No excursion events detected for the active filter set.</p>
                    <p className="text-gray-400 text-[11px] mt-0.5">All matching records are in PASS status.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50/90 sticky top-0 border-b border-gray-200 text-gray-600">
                        <tr>
                          <th className="px-4 py-2 font-bold uppercase tracking-wider">Date</th>
                          <th className="px-4 py-2 font-bold uppercase tracking-wider">Room</th>
                          <th className="px-4 py-2 font-bold uppercase tracking-wider text-center">Grade</th>
                          <th className="px-4 py-2 font-bold uppercase tracking-wider">Parameter</th>
                          <th className="px-4 py-2 font-bold uppercase tracking-wider text-right">Result</th>
                          <th className="px-4 py-2 font-bold text-blue-600 uppercase tracking-wider text-right">Alert Level</th>
                          <th className="px-4 py-2 font-bold text-green-600 uppercase tracking-wider text-right">Action Level</th>
                          <th className="px-4 py-2 font-bold text-red-600 uppercase tracking-wider text-right">Acceptance Criteria</th>
                          <th className="px-4 py-2 font-bold uppercase tracking-wider text-center">Final Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {allExcursionRecords.map((rec) => {
                          const lim = getRecordLimits(rec);
                          const st = (rec.final_status || rec.calculated_status || "").toUpperCase();
                          return (
                            <tr
                              key={rec.measurement_id}
                              onClick={() => setSelectedExcursion(rec)}
                              className="hover:bg-orange-50/60 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                                {rec.measurement_date || "-"}
                              </td>
                              <td className="px-4 py-2.5 text-gray-900 font-semibold">
                                {rec.room_name || "-"}
                              </td>
                              <td className="px-4 py-2.5 text-center font-bold">
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-[10px]">
                                  Grade {rec.room_grade || "-"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-700 truncate max-w-[160px]">
                                {rec.parameter_name}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900">
                                {rec.result !== null ? rec.result : "-"} {rec.unit || ""}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-blue-600">
                                {lim.alert !== null ? lim.alert : "-"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-green-600">
                                {lim.action !== null ? lim.action : "-"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-red-600">
                                {lim.acceptance !== null ? lim.acceptance : "-"}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {getStatusBadge(st)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Monthly Summary Table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    <h4 className="font-bold text-xs text-gray-800 uppercase tracking-wider">
                      Monthly Summary Breakdown
                    </h4>
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Calculated from {filteredMeasurements.length} measurements
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-gray-700 uppercase tracking-wider"
                        >
                          Month
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-gray-700 uppercase tracking-wider text-center"
                        >
                          Measurements
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-orange-700 uppercase tracking-wider text-right"
                        >
                          Average
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-gray-700 uppercase tracking-wider text-right"
                        >
                          Min
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-blue-700 uppercase tracking-wider text-right"
                        >
                          Max
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-gray-900 uppercase tracking-wider text-center"
                        >
                          PASS
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-blue-600 uppercase tracking-wider text-center"
                        >
                          ALERT
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-green-600 uppercase tracking-wider text-center"
                        >
                          ACTION
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2.5 font-bold text-red-600 uppercase tracking-wider text-center"
                        >
                          OOS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {monthlyStats.map((stat) => (
                        <tr
                          key={stat.monthNum}
                          className={`hover:bg-gray-50/70 transition-colors ${
                            stat.measurements === 0 ? "opacity-60 bg-gray-50/20" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap">
                            {stat.fullLabel}
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono font-medium">
                            {stat.measurements > 0 ? (
                              stat.measurements
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-800">
                            {stat.average !== null ? (
                              stat.average.toFixed(2)
                            ) : (
                              <span className="text-gray-300 font-normal">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                            {stat.min !== null ? stat.min : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-700">
                            {stat.max !== null ? stat.max : <span className="text-gray-300 font-normal">-</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {stat.passCount > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded font-bold text-[10px] bg-gray-100 text-black border border-gray-300">
                                {stat.passCount}
                              </span>
                            ) : stat.measurements > 0 ? (
                              <span className="text-gray-400 font-mono text-[11px]">0</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {stat.alertCount > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded font-bold text-[10px] bg-blue-50 text-blue-600 border border-blue-200">
                                {stat.alertCount}
                              </span>
                            ) : stat.measurements > 0 ? (
                              <span className="text-gray-400 font-mono text-[11px]">0</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {stat.actionCount > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded font-bold text-[10px] bg-green-50 text-green-600 border border-green-200">
                                {stat.actionCount}
                              </span>
                            ) : stat.measurements > 0 ? (
                              <span className="text-gray-400 font-mono text-[11px]">0</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {stat.oosCount > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded font-extrabold text-[10px] bg-red-100 text-red-700 border border-red-300">
                                {stat.oosCount}
                              </span>
                            ) : stat.measurements > 0 ? (
                              <span className="text-gray-400 font-mono text-[11px]">0</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Summary Total Row */}
                    <tfoot className="bg-gray-50/90 font-bold border-t-2 border-gray-200">
                      <tr>
                        <td className="px-4 py-3 text-gray-900 uppercase tracking-wider text-[11px]">
                          Total / Overall
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-900">
                          {totalSummary.measurements}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-orange-700">
                          {totalSummary.average !== null ? totalSummary.average.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                          {totalSummary.min !== null ? totalSummary.min : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-blue-700">
                          {totalSummary.max !== null ? totalSummary.max : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-black font-mono">
                          {totalSummary.passCount}
                        </td>
                        <td className="px-4 py-3 text-center text-blue-600 font-mono">
                          {totalSummary.alertCount}
                        </td>
                        <td className="px-4 py-3 text-center text-green-600 font-mono">
                          {totalSummary.actionCount}
                        </td>
                        <td className="px-4 py-3 text-center text-red-600 font-mono">
                          {totalSummary.oosCount}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Excursion Inspector Modal / Popover */}
      {selectedExcursion && (() => {
        const lim = getRecordLimits(selectedExcursion);
        const finalStatus = (selectedExcursion.final_status || selectedExcursion.calculated_status || "").toUpperCase();

        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <h3 className="font-bold text-sm text-gray-900">
                    Excursion Record Inspection
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedExcursion(null)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* 9 Requested Fields Inspection Grid */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50/60 p-4 rounded-lg border border-gray-100">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Date
                    </span>
                    <span className="font-semibold text-gray-900 text-sm">
                      {selectedExcursion.measurement_date || "-"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Room
                    </span>
                    <span className="font-semibold text-gray-900 text-sm">
                      {selectedExcursion.room_name || "-"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Cleanliness Grade
                    </span>
                    <span className="font-bold text-gray-900">
                      Grade {selectedExcursion.room_grade || "-"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Parameter
                    </span>
                    <span className="font-semibold text-gray-900">
                      {selectedExcursion.parameter_name}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Measured Result
                    </span>
                    <span className="font-mono font-bold text-base text-gray-900">
                      {selectedExcursion.result !== null ? selectedExcursion.result : "-"}{" "}
                      <span className="text-xs font-normal text-gray-500">
                        {selectedExcursion.unit || ""}
                      </span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Final Reviewed Status
                    </span>
                    <div className="mt-1">
                      {getStatusBadge(finalStatus)}
                    </div>
                  </div>
                </div>

                {/* Criteria Limits Breakdown */}
                <div>
                  <h5 className="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-2">
                    Evaluation Criteria Limits
                  </h5>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-center">
                      <div className="text-[10px] font-bold text-blue-600 uppercase">Alert Level</div>
                      <div className="text-base font-mono font-bold text-blue-700 mt-0.5">
                        {lim.alert !== null ? lim.alert : "N/A"}
                      </div>
                    </div>

                    <div className="p-3 bg-green-50/70 border border-green-200 rounded-lg text-center">
                      <div className="text-[10px] font-bold text-green-600 uppercase">Action Level</div>
                      <div className="text-base font-mono font-bold text-green-700 mt-0.5">
                        {lim.action !== null ? lim.action : "N/A"}
                      </div>
                    </div>

                    <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg text-center">
                      <div className="text-[10px] font-bold text-red-600 uppercase">Acceptance (OOS)</div>
                      <div className="text-base font-mono font-bold text-red-700 mt-0.5">
                        {lim.acceptance !== null ? lim.acceptance : "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedExcursion(null)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
