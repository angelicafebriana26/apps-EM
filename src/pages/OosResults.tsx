import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Building2,
  Check,
  Clock,
  Dna,
  Filter,
  Layers,
  Loader2,
  Microscope,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X
} from "lucide-react";
import { cn } from "../lib/utils";
import { getEMMeasurements, updateMeasurement, EMMeasurementRecord } from "../services/emDatabaseService";
import { emCriteriaMaster } from "../lib/emCriteriaConfig";

const MICROBIOLOGICAL_PARAMETERS = ["부유균", "낙하균", "표면균"] as const;

type MicroorganismStatus = "NOT ENTERED" | "IDENTIFIED" | "NOT IDENTIFIED";

const MONTH_OPTIONS = [
  { value: "01", label: "01 (Jan)" },
  { value: "02", label: "02 (Feb)" },
  { value: "03", label: "03 (Mar)" },
  { value: "04", label: "04 (Apr)" },
  { value: "05", label: "05 (May)" },
  { value: "06", label: "06 (Jun)" },
  { value: "07", label: "07 (Jul)" },
  { value: "08", label: "08 (Aug)" },
  { value: "09", label: "09 (Sep)" },
  { value: "10", label: "10 (Oct)" },
  { value: "11", label: "11 (Nov)" },
  { value: "12", label: "12 (Dec)" }
];

function parseDateParts(dateStr?: string | null) {
  if (!dateStr) return { year: "", month: "", day: "", raw: "" };
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) {
    return {
      year: match[1],
      month: match[2].padStart(2, "0"),
      day: match[3].padStart(2, "0"),
      raw: clean
    };
  }
  const yearMonthMatch = clean.match(/^(\d{4})[-./](\d{1,2})/);
  if (yearMonthMatch) {
    return {
      year: yearMonthMatch[1],
      month: yearMonthMatch[2].padStart(2, "0"),
      day: "",
      raw: clean
    };
  }
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  return {
    year: yearMatch ? yearMatch[1] : "",
    month: "",
    day: "",
    raw: clean
  };
}

export function OosResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"records" | "microorganism">(
    urlTab === "microorganism" ? "microorganism" : "records"
  );
  const [measurements, setMeasurements] = useState<EMMeasurementRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentTabParam = searchParams.get("tab");
    if (currentTabParam === "microorganism" && activeTab !== "microorganism") {
      setActiveTab("microorganism");
    } else if (currentTabParam === "records" && activeTab !== "records") {
      setActiveTab("records");
    }
  }, [searchParams, activeTab]);

  // Filters for OOS Records tab
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterRoom, setFilterRoom] = useState<string>("");
  const [filterParameter, setFilterParameter] = useState<string>("");

  // Filters for Microorganism Analysis tab
  const [analysisYear, setAnalysisYear] = useState<string>("");
  const [analysisMonth, setAnalysisMonth] = useState<string>("");
  const [analysisRoom, setAnalysisRoom] = useState<string>("");
  const [analysisParameter, setAnalysisParameter] = useState<string>("");
  const [analysisOrganism, setAnalysisOrganism] = useState<string>("");

  // Helper to extract list of organism names safely from record
  const getOrganismList = (record: EMMeasurementRecord): string[] => {
    if (Array.isArray(record.microorganism_names) && record.microorganism_names.length > 0) {
      return record.microorganism_names.filter((n) => typeof n === "string" && n.trim().length > 0);
    }
    if (record.microorganism_name && typeof record.microorganism_name === "string" && record.microorganism_name.trim()) {
      return record.microorganism_name.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  // State for Editing Modal
  const [editingRecord, setEditingRecord] = useState<EMMeasurementRecord | null>(null);
  const [editSubmissionDate, setEditSubmissionDate] = useState<string>("");
  const [editIdStatus, setEditIdStatus] = useState<MicroorganismStatus>("NOT ENTERED");
  const [editOrganismNames, setEditOrganismNames] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Confirmation state for deleting one organism name
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Confirmation state for switching status from IDENTIFIED to NOT IDENTIFIED / NOT ENTERED when names exist
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<{ pendingStatus: MicroorganismStatus } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEMMeasurements();
      setMeasurements(data || []);
    } catch (err: any) {
      console.error("Failed to load EM measurements for OOS results:", err);
      setError(err?.message || "Failed to load records from Firestore.");
    } finally {
      setLoading(false);
    }
  };

  // Base list of ONLY microbiological OOS records (exclude particles, exclude non-OOS)
  const microbiologicalOosRecords = useMemo(() => {
    return measurements.filter((m) => {
      // Must be microbiological parameter
      const paramName = (m.parameter_name || "").trim();
      const isMicrobiological = MICROBIOLOGICAL_PARAMETERS.includes(
        paramName as (typeof MICROBIOLOGICAL_PARAMETERS)[number]
      );
      if (!isMicrobiological) return false;

      // Must have final reviewed status = OOS
      const finalStatus = (m.final_status || m.calculated_status || "").trim().toUpperCase();
      return finalStatus === "OOS";
    });
  }, [measurements]);

  // Extract distinct available Years and Rooms from the microbiological OOS dataset
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    microbiologicalOosRecords.forEach((m) => {
      const { year } = parseDateParts(m.measurement_date);
      if (year) years.add(year);
    });
    return Array.from(years).sort().reverse();
  }, [microbiologicalOosRecords]);

  const availableRooms = useMemo(() => {
    const rooms = new Set<string>();
    microbiologicalOosRecords.forEach((m) => {
      if (m.room_name && m.room_name.trim()) {
        rooms.add(m.room_name.trim());
      }
    });
    return Array.from(rooms).sort();
  }, [microbiologicalOosRecords]);

  // Apply active filters
  const filteredOosRecords = useMemo(() => {
    return microbiologicalOosRecords.filter((record) => {
      const { year, month } = parseDateParts(record.measurement_date);

      // Year filter
      if (filterYear && year !== filterYear) {
        return false;
      }

      // Month filter
      if (filterMonth && month !== filterMonth) {
        return false;
      }

      // Room filter
      if (filterRoom && record.room_name !== filterRoom) {
        return false;
      }

      // Parameter filter
      if (filterParameter && record.parameter_name !== filterParameter) {
        return false;
      }

      return true;
    });
  }, [microbiologicalOosRecords, filterYear, filterMonth, filterRoom, filterParameter]);

  // Reset filters
  const handleResetFilters = () => {
    setFilterYear("");
    setFilterMonth("");
    setFilterRoom("");
    setFilterParameter("");
  };

  // Available distinct identified microorganism names across all microbiological OOS records
  const availableMicroorganisms = useMemo(() => {
    const orgSet = new Set<string>();
    microbiologicalOosRecords.forEach((m) => {
      const rawStatus = (m.microorganism_id_status || "").toUpperCase();
      if (rawStatus === "IDENTIFIED") {
        const list = getOrganismList(m);
        list.forEach((name) => {
          if (name && name.trim()) {
            orgSet.add(name.trim());
          }
        });
      }
    });
    return Array.from(orgSet).sort((a, b) => a.localeCompare(b));
  }, [microbiologicalOosRecords]);

  // Reset analysis filters
  const handleResetAnalysisFilters = () => {
    setAnalysisYear("");
    setAnalysisMonth("");
    setAnalysisRoom("");
    setAnalysisParameter("");
    setAnalysisOrganism("");
  };

  // Base filtered records for Microorganism Analysis tab (by Year, Month, Room, Parameter)
  const analysisFilteredBaseRecords = useMemo(() => {
    return microbiologicalOosRecords.filter((record) => {
      const { year, month } = parseDateParts(record.measurement_date);
      if (analysisYear && year !== analysisYear) return false;
      if (analysisMonth && month !== analysisMonth) return false;
      if (analysisRoom && record.room_name !== analysisRoom) return false;
      if (analysisParameter && record.parameter_name !== analysisParameter) return false;
      return true;
    });
  }, [microbiologicalOosRecords, analysisYear, analysisMonth, analysisRoom, analysisParameter]);

  // Summary counts for the 6 summary cards
  const analysisSummaryStats = useMemo(() => {
    const totalMicrobioOos = analysisFilteredBaseRecords.length;
    let identified = 0;
    let notIdentified = 0;
    let pendingNotEntered = 0;

    analysisFilteredBaseRecords.forEach((record) => {
      const status = (record.microorganism_id_status || "").toUpperCase();
      const names = getOrganismList(record);
      if (status === "IDENTIFIED" && names.length > 0) {
        identified++;
      } else if (status === "NOT IDENTIFIED") {
        notIdentified++;
      } else {
        pendingNotEntered++;
      }
    });

    return {
      totalMicrobioOos,
      identified,
      notIdentified,
      pendingNotEntered
    };
  }, [analysisFilteredBaseRecords]);

  // Flatten identified records into individual detection events
  // (Counting rule: one microorganism linked to one OOS measurement = one occurrence.
  // If one OOS measurement contains two organism names, count each organism as one occurrence)
  const analysisIdentifiedEvents = useMemo(() => {
    const events: Array<{
      measurement_id: string;
      room_name: string;
      room_grade?: string | null;
      parameter_name: string;
      organism: string;
      measurement_date?: string | null;
    }> = [];

    analysisFilteredBaseRecords.forEach((record) => {
      const status = (record.microorganism_id_status || "").toUpperCase();
      if (status !== "IDENTIFIED") return;
      const names = getOrganismList(record);
      if (names.length === 0) return;

      names.forEach((name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (analysisOrganism && trimmed !== analysisOrganism) return;

        events.push({
          measurement_id: record.measurement_id,
          room_name: record.room_name || "Unknown Room",
          room_grade: record.room_grade,
          parameter_name: record.parameter_name || "Unknown",
          organism: trimmed,
          measurement_date: record.measurement_date
        });
      });
    });

    return events;
  }, [analysisFilteredBaseRecords, analysisOrganism]);

  // Unique organisms count
  const analysisUniqueOrganismsCount = useMemo(() => {
    return new Set(analysisIdentifiedEvents.map((e) => e.organism)).size;
  }, [analysisIdentifiedEvents]);

  // Affected rooms count
  const analysisAffectedRoomsCount = useMemo(() => {
    return new Set(analysisIdentifiedEvents.map((e) => e.room_name)).size;
  }, [analysisIdentifiedEvents]);

  // Table 1: Most Frequently Detected Microorganisms (Sort highest occurrence first)
  const mostFrequentOrganisms = useMemo(() => {
    const orgMap = new Map<string, { organism: string; occurrences: number; rooms: Set<string> }>();

    analysisIdentifiedEvents.forEach((ev) => {
      const existing = orgMap.get(ev.organism);
      if (existing) {
        existing.occurrences += 1;
        existing.rooms.add(ev.room_name);
      } else {
        orgMap.set(ev.organism, {
          organism: ev.organism,
          occurrences: 1,
          rooms: new Set([ev.room_name])
        });
      }
    });

    return Array.from(orgMap.values())
      .map((item) => ({
        organism: item.organism,
        occurrences: item.occurrences,
        rooms: Array.from(item.rooms).sort(),
        roomCount: item.rooms.size
      }))
      .sort((a, b) => {
        if (b.occurrences !== a.occurrences) {
          return b.occurrences - a.occurrences;
        }
        return a.organism.localeCompare(b.organism);
      });
  }, [analysisIdentifiedEvents]);

  // Table 2: Microorganism Occurrence by Room (Room | Microorganism | Occurrences)
  const occurrencesByRoom = useMemo(() => {
    const roomMap = new Map<string, { room: string; room_grade?: string | null; organism: string; occurrences: number }>();

    analysisIdentifiedEvents.forEach((ev) => {
      const key = `${ev.room_name}:::${ev.organism}`;
      const existing = roomMap.get(key);
      if (existing) {
        existing.occurrences += 1;
      } else {
        roomMap.set(key, {
          room: ev.room_name,
          room_grade: ev.room_grade,
          organism: ev.organism,
          occurrences: 1
        });
      }
    });

    return Array.from(roomMap.values()).sort((a, b) => {
      if (a.room !== b.room) {
        return a.room.localeCompare(b.room);
      }
      if (b.occurrences !== a.occurrences) {
        return b.occurrences - a.occurrences;
      }
      return a.organism.localeCompare(b.organism);
    });
  }, [analysisIdentifiedEvents]);

  // Table 3: Occurrence by Parameter (Microorganism | 부유균 | 낙하균 | 표면균 | Total)
  const occurrencesByParameter = useMemo(() => {
    const map = new Map<string, { organism: string; airborne: number; settle: number; surface: number; total: number }>();

    analysisIdentifiedEvents.forEach((ev) => {
      let existing = map.get(ev.organism);
      if (!existing) {
        existing = {
          organism: ev.organism,
          airborne: 0,
          settle: 0,
          surface: 0,
          total: 0
        };
        map.set(ev.organism, existing);
      }

      existing.total += 1;
      const p = ev.parameter_name.trim();
      if (p === "부유균") {
        existing.airborne += 1;
      } else if (p === "낙하균") {
        existing.settle += 1;
      } else if (p === "표면균") {
        existing.surface += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.organism.localeCompare(b.organism);
    });
  }, [analysisIdentifiedEvents]);

  // Open Edit Modal
  const handleOpenEditModal = (record: EMMeasurementRecord) => {
    setEditingRecord(record);
    setEditSubmissionDate(record.sample_submission_date || "");
    
    // Normalize status to one of the 3 allowed values
    const rawStatus = (record.microorganism_id_status || "").toUpperCase();
    let initialStatus: MicroorganismStatus = "NOT ENTERED";
    if (rawStatus === "IDENTIFIED") {
      initialStatus = "IDENTIFIED";
    } else if (rawStatus === "NOT IDENTIFIED") {
      initialStatus = "NOT IDENTIFIED";
    }
    setEditIdStatus(initialStatus);

    const existingList = getOrganismList(record);
    if (existingList.length > 0) {
      setEditOrganismNames([...existingList]);
    } else if (initialStatus === "IDENTIFIED") {
      setEditOrganismNames([""]);
    } else {
      setEditOrganismNames([]);
    }

    setValidationError(null);
    setDeleteConfirmIndex(null);
    setStatusChangeConfirm(null);
  };

  const handleCloseEditModal = () => {
    if (isSaving) return;
    setEditingRecord(null);
    setValidationError(null);
    setDeleteConfirmIndex(null);
    setStatusChangeConfirm(null);
  };

  // Handle status selection with confirmation if names already exist
  const handleStatusChange = (newStatus: MicroorganismStatus) => {
    if (editIdStatus === "IDENTIFIED" && newStatus !== "IDENTIFIED") {
      const hasEnteredNames = editOrganismNames.some((n) => n.trim().length > 0);
      if (hasEnteredNames) {
        setStatusChangeConfirm({ pendingStatus: newStatus });
        return;
      }
    }

    setEditIdStatus(newStatus);
    if (newStatus === "IDENTIFIED" && editOrganismNames.length === 0) {
      setEditOrganismNames([""]);
    }
    if (validationError) setValidationError(null);
  };

  const handleConfirmStatusChange = () => {
    if (statusChangeConfirm) {
      setEditIdStatus(statusChangeConfirm.pendingStatus);
      setEditOrganismNames([]);
      setStatusChangeConfirm(null);
      if (validationError) setValidationError(null);
    }
  };

  const handleCancelStatusChange = () => {
    setStatusChangeConfirm(null);
  };

  // Add another microorganism name
  const handleAddOrganismName = () => {
    setEditOrganismNames((prev) => [...prev, ""]);
    if (validationError) setValidationError(null);
  };

  // Edit microorganism name at index
  const handleEditOrganismName = (index: number, val: string) => {
    setEditOrganismNames((prev) => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
    if (validationError) setValidationError(null);
  };

  // Request remove microorganism name
  const handleRequestRemoveOrganism = (index: number) => {
    setDeleteConfirmIndex(index);
  };

  const handleConfirmRemoveOrganism = () => {
    if (deleteConfirmIndex !== null) {
      setEditOrganismNames((prev) => {
        const updated = prev.filter((_, idx) => idx !== deleteConfirmIndex);
        if (updated.length === 0 && editIdStatus === "IDENTIFIED") {
          return [""];
        }
        return updated;
      });
      setDeleteConfirmIndex(null);
      if (validationError) setValidationError(null);
    }
  };

  const handleCancelRemoveOrganism = () => {
    setDeleteConfirmIndex(null);
  };

  // Save Modal Form
  const handleSaveModal = async () => {
    if (!editingRecord) return;

    let cleanNames: string[] = [];
    if (editIdStatus === "IDENTIFIED") {
      cleanNames = editOrganismNames.map((n) => n.trim()).filter((n) => n.length > 0);
      if (cleanNames.length === 0) {
        setValidationError("Please enter at least one microorganism name.");
        return;
      }
    }

    setValidationError(null);
    setIsSaving(true);

    const submissionDateToSave = editSubmissionDate.trim() || null;
    const idStatusToSave = editIdStatus;
    const organismNamesToSave = editIdStatus === "IDENTIFIED" ? cleanNames : null;
    const primaryNameToSave = organismNamesToSave && organismNamesToSave.length > 0 ? organismNamesToSave.join(", ") : null;

    try {
      // Persist to Firestore linked to the measurement document
      await updateMeasurement(editingRecord.measurement_id, {
        sample_submission_date: submissionDateToSave,
        microorganism_id_status: idStatusToSave,
        microorganism_names: organismNamesToSave,
        microorganism_name: primaryNameToSave
      });

      // Update local state so the table updates immediately
      setMeasurements((prev) =>
        prev.map((m) =>
          m.measurement_id === editingRecord.measurement_id
            ? {
                ...m,
                sample_submission_date: submissionDateToSave,
                microorganism_id_status: idStatusToSave,
                microorganism_names: organismNamesToSave,
                microorganism_name: primaryNameToSave
              }
            : m
        )
      );

      setSaveSuccessMessage(`Microorganism identification saved for ${editingRecord.room_name} (${editingRecord.parameter_name})`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);

      setEditingRecord(null);
    } catch (err: any) {
      console.error("Failed to save microorganism identification:", err);
      setValidationError(err?.message || "Failed to save to Firestore. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to determine applicable limit from existing EM data / criteria engine
  const getApplicableLimit = (record: EMMeasurementRecord): string => {
    if (record.acceptance_criteria !== null && record.acceptance_criteria !== undefined) {
      return `≤ ${record.acceptance_criteria}`;
    }
    const grade = (record.room_grade || "").trim().toUpperCase();
    const param = (record.parameter_name || "").trim();
    if (grade && param && emCriteriaMaster[grade]?.[param]) {
      const acceptanceVal = emCriteriaMaster[grade][param].acceptance;
      if (acceptanceVal !== null && acceptanceVal !== undefined) {
        return `≤ ${acceptanceVal}`;
      }
    }
    if (record.action_limit !== null && record.action_limit !== undefined) {
      return `≤ ${record.action_limit}`;
    }
    return "-";
  };

  // Helper to get unit for display
  const getDisplayUnit = (record: EMMeasurementRecord): string => {
    if (record.unit && record.unit.trim()) {
      return record.unit;
    }
    if (record.parameter_name === "부유균") {
      return "CFU/m³";
    }
    return "CFU/plate";
  };

  return (
    <div className="qc-card overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      {/* Tabs Header */}
      <div className="border-b border-gray-200 bg-gray-50/60">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("records");
              setSearchParams({ tab: "records" });
            }}
            className={cn(
              activeTab === "records"
                ? "border-orange-500 text-orange-600 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              "whitespace-nowrap py-3.5 px-1 border-b-2 font-medium text-xs flex items-center transition-colors cursor-pointer"
            )}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            OOS Records
            {microbiologicalOosRecords.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                {microbiologicalOosRecords.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("microorganism");
              setSearchParams({ tab: "microorganism" });
            }}
            className={cn(
              activeTab === "microorganism"
                ? "border-orange-500 text-orange-600 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              "whitespace-nowrap py-3.5 px-1 border-b-2 font-medium text-xs flex items-center transition-colors cursor-pointer"
            )}
          >
            <Bug className="mr-2 h-4 w-4" />
            Microorganism Analysis
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "records" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Toolbar */}
            <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50/40">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                  {/* Year Filter */}
                  <div>
                    <label className="qc-label">
                      Year
                    </label>
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="qc-select"
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
                  <div>
                    <label className="qc-label">
                      Month
                    </label>
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="qc-select"
                    >
                      <option value="">All Months</option>
                      {MONTH_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Room Filter */}
                  <div>
                    <label className="qc-label">
                      Room
                    </label>
                    <select
                      value={filterRoom}
                      onChange={(e) => setFilterRoom(e.target.value)}
                      className="qc-select truncate"
                    >
                      <option value="">All Rooms</option>
                      {availableRooms.map((rm) => (
                        <option key={rm} value={rm}>
                          {rm}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Parameter Filter */}
                  <div>
                    <label className="qc-label">
                      Parameter
                    </label>
                    <select
                      value={filterParameter}
                      onChange={(e) => setFilterParameter(e.target.value)}
                      className="qc-select"
                    >
                      <option value="">All Microbiological Parameters</option>
                      {MICROBIOLOGICAL_PARAMETERS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Reset button and status count badge */}
                <div className="flex items-center gap-3 self-end lg:self-center">
                  {(filterYear || filterMonth || filterRoom || filterParameter) && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="btn-secondary"
                      title="Reset filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  )}
                  <div className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                    {loading ? (
                      <span className="text-gray-400">Loading...</span>
                    ) : (
                      <span>
                        Showing <strong className="text-red-600 font-bold">{filteredOosRecords.length}</strong> OOS record{filteredOosRecords.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Success Notification Banner */}
            {saveSuccessMessage && (
              <div className="mx-4 sm:mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveSuccessMessage(null)}
                  className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Error Banner if any */}
            {error && (
              <div className="m-4 sm:m-6 p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  className="font-bold underline uppercase text-[10px] cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* OOS Records Table Container */}
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
                {loading ? (
                  <div className="py-20 text-center">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
                    <p className="text-xs font-semibold text-gray-500">Loading microbiological OOS records from Firestore...</p>
                  </div>
                ) : filteredOosRecords.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-500">
                    <ShieldAlert className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-gray-700 font-bold text-base mb-1">No Microbiological OOS Records</p>
                    <p className="text-gray-400 text-xs max-w-md mx-auto">
                      {microbiologicalOosRecords.length === 0
                        ? "There are currently no microbiological OOS events (부유균, 낙하균, 표면균) recorded in the database."
                        : "No microbiological OOS records match the current filter selection."}
                    </p>
                    {(filterYear || filterMonth || filterRoom || filterParameter) && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-4 btn-primary"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="qc-table">
                      <thead>
                        <tr>
                          <th scope="col" className="qc-th whitespace-nowrap">
                            Date of EM Measurement
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap">
                            Sample Submission Date
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap">
                            Room
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap">
                            Parameter
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap text-right">
                            Result
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap">
                            Unit
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap">
                            Applicable Limit
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap">
                            Microorganism ID Status
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap">
                            Microorganism Name
                          </th>
                          <th scope="col" className="qc-th whitespace-nowrap text-center">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOosRecords.map((record) => {
                          const applicableLimit = getApplicableLimit(record);
                          const displayUnit = getDisplayUnit(record);

                          const idStatus = (record.microorganism_id_status || "").toUpperCase();

                          return (
                            <tr
                              key={record.measurement_id}
                              className="hover:bg-red-50/30 transition-colors"
                            >
                              {/* 1. Date of EM Measurement */}
                              <td className="qc-td font-mono font-medium text-gray-900 whitespace-nowrap">
                                {record.measurement_date || "-"}
                              </td>

                              {/* 2. Sample Submission Date */}
                              <td className="qc-td whitespace-nowrap">
                                {record.sample_submission_date ? (
                                  <span className="font-mono font-medium text-gray-800">
                                    {record.sample_submission_date}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic">Not entered</span>
                                )}
                              </td>

                              {/* 3. Room */}
                              <td className="qc-td font-semibold text-gray-900 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span>{record.room_name || "-"}</span>
                                  {record.room_grade && (
                                    <span className="px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded text-[10px] font-bold border border-gray-200">
                                      Gr {record.room_grade}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 4. Parameter */}
                              <td className="qc-td font-medium text-gray-800 whitespace-nowrap">
                                <span className="px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 rounded font-semibold text-[11px]">
                                  {record.parameter_name}
                                </span>
                              </td>

                              {/* 5. Result */}
                              <td className="qc-td font-mono font-bold text-red-600 text-right whitespace-nowrap">
                                {record.result !== null && record.result !== undefined
                                  ? record.result
                                  : "-"}
                              </td>

                              {/* 6. Unit */}
                              <td className="qc-td text-gray-600 whitespace-nowrap font-mono text-[11px]">
                                {displayUnit}
                              </td>

                              {/* 7. Applicable Limit */}
                              <td className="qc-td font-mono font-semibold text-gray-700 whitespace-nowrap">
                                {applicableLimit}
                              </td>

                              {/* 8. Microorganism ID Status */}
                              <td className="qc-td whitespace-nowrap">
                                {idStatus === "IDENTIFIED" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    IDENTIFIED
                                  </span>
                                ) : idStatus === "NOT IDENTIFIED" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Not identified
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic">Not entered</span>
                                )}
                              </td>

                              {/* 9. Microorganism Name */}
                              <td className="qc-td">
                                {idStatus === "IDENTIFIED" ? (
                                  (() => {
                                    const orgList = getOrganismList(record);
                                    if (orgList.length > 0) {
                                      return (
                                        <div className="flex flex-wrap gap-1.5 max-w-xs py-0.5">
                                          {orgList.map((name, idx) => (
                                            <span
                                              key={idx}
                                              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-gray-900 bg-gray-100 border border-gray-200 font-serif italic shadow-2xs"
                                            >
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      );
                                    }
                                    return <span className="text-gray-400 italic">Not entered</span>;
                                  })()
                                ) : idStatus === "NOT IDENTIFIED" ? (
                                  <span className="text-gray-500 italic">Not identified</span>
                                ) : (
                                  <span className="text-gray-400 italic">Not entered</span>
                                )}
                              </td>

                              {/* Action column */}
                              <td className="qc-td text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(record)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 hover:text-orange-800 border border-orange-200 rounded shadow-xs transition-colors cursor-pointer"
                                  title="Edit Microorganism Identification"
                                >
                                  <Pencil className="w-3 h-3 text-orange-600" />
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Microorganism Analysis Tab */}
        {activeTab === "microorganism" && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Filter Bar */}
            <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50/40">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 flex-1">
                  {/* 1. Year */}
                  <div>
                    <label className="qc-label">
                      Year
                    </label>
                    <select
                      value={analysisYear}
                      onChange={(e) => setAnalysisYear(e.target.value)}
                      className="qc-select"
                    >
                      <option value="">All Years</option>
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Month */}
                  <div>
                    <label className="qc-label">
                      Month
                    </label>
                    <select
                      value={analysisMonth}
                      onChange={(e) => setAnalysisMonth(e.target.value)}
                      className="qc-select"
                    >
                      <option value="">All Months</option>
                      {MONTH_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Room */}
                  <div>
                    <label className="qc-label">
                      Room
                    </label>
                    <select
                      value={analysisRoom}
                      onChange={(e) => setAnalysisRoom(e.target.value)}
                      className="qc-select"
                    >
                      <option value="">All Rooms</option>
                      {availableRooms.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Parameter */}
                  <div>
                    <label className="qc-label">
                      Parameter
                    </label>
                    <select
                      value={analysisParameter}
                      onChange={(e) => setAnalysisParameter(e.target.value)}
                      className="qc-select"
                    >
                      <option value="">All Microbiological Parameters</option>
                      <option value="부유균">부유균 (Airborne)</option>
                      <option value="낙하균">낙하균 (Settle Plate)</option>
                      <option value="표면균">표면균 (Surface)</option>
                    </select>
                  </div>

                  {/* 5. Microorganism */}
                  <div>
                    <label className="qc-label">
                      Microorganism
                    </label>
                    <select
                      value={analysisOrganism}
                      onChange={(e) => setAnalysisOrganism(e.target.value)}
                      className="qc-select italic font-serif"
                    >
                      <option value="" className="font-sans not-italic">All Microorganisms</option>
                      {availableMicroorganisms.map((org) => (
                        <option key={org} value={org}>
                          {org}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Reset Filters */}
                {(analysisYear || analysisMonth || analysisRoom || analysisParameter || analysisOrganism) && (
                  <div className="flex items-end self-end lg:self-center pt-2 lg:pt-4">
                    <button
                      type="button"
                      onClick={handleResetAnalysisFilters}
                      className="btn-secondary"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="p-5 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Total Microbiological OOS */}
                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                      Total Microbio OOS
                    </span>
                    <ShieldAlert className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-gray-900 font-mono">
                      {analysisSummaryStats.totalMicrobioOos}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">events</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Total OOS in criteria</p>
                </div>

                {/* 2. Identified */}
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                      Identified
                    </span>
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-emerald-700 font-mono">
                      {analysisSummaryStats.identified}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-medium">events</span>
                  </div>
                  <p className="text-[10px] text-emerald-600/80 mt-0.5">Lab identification complete</p>
                </div>

                {/* 3. Not Identified */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                      Not Identified
                    </span>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-amber-700 font-mono">
                      {analysisSummaryStats.notIdentified}
                    </span>
                    <span className="text-[11px] text-amber-600 font-medium">events</span>
                  </div>
                  <p className="text-[10px] text-amber-600/80 mt-0.5">Unidentifiable organism</p>
                </div>

                {/* 4. Pending / Not Entered */}
                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                      Pending / Not Entered
                    </span>
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-gray-700 font-mono">
                      {analysisSummaryStats.pendingNotEntered}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">events</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Awaiting lab entry</p>
                </div>

                {/* 5. Unique Microorganisms */}
                <div className="bg-white p-3.5 rounded-xl border border-violet-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider block">
                      Unique Organisms
                    </span>
                    <Dna className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-violet-800 font-mono">
                      {analysisUniqueOrganismsCount}
                    </span>
                    <span className="text-[11px] text-violet-600 font-medium">species/types</span>
                  </div>
                  <p className="text-[10px] text-violet-600/80 mt-0.5">Distinct identified</p>
                </div>

                {/* 6. Affected Rooms */}
                <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                      Affected Rooms
                    </span>
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-blue-800 font-mono">
                      {analysisAffectedRoomsCount}
                    </span>
                    <span className="text-[11px] text-blue-600 font-medium">rooms</span>
                  </div>
                  <p className="text-[10px] text-blue-600/80 mt-0.5">With identified organisms</p>
                </div>
              </div>

              {/* Check if any identified events exist */}
              {analysisIdentifiedEvents.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-xs">
                  <div className="mx-auto w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 mb-3">
                    <Microscope className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">No Identified Microorganism Data</h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                    No records matching the selected filters currently have{" "}
                    <span className="font-semibold text-gray-700">Microorganism ID Status = IDENTIFIED</span> with entered organism names.
                  </p>
                  <p className="text-[11px] text-gray-400 mt-2">
                    To record laboratory results, switch to the <span className="font-medium text-gray-600">OOS Records</span> tab and click <span className="font-medium text-gray-600">Edit</span> on any microbiological OOS row.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Section 1: Most Frequently Detected Microorganisms */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <Bug className="w-4 h-4 text-orange-600" />
                          Most Frequently Detected Microorganisms
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Ranked by detection occurrences across all microbiological OOS measurements.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-gray-500">
                        {mostFrequentOrganisms.length} identified organism(s)
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="qc-table">
                        <thead>
                          <tr>
                            <th scope="col" className="qc-th w-12 text-center">#</th>
                            <th scope="col" className="qc-th">Microorganism</th>
                            <th scope="col" className="qc-th text-center w-28">Occurrences</th>
                            <th scope="col" className="qc-th">Rooms Detected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mostFrequentOrganisms.map((item, idx) => (
                            <tr key={item.organism}>
                              <td className="qc-td font-mono font-bold text-gray-400 text-center">
                                {idx + 1}
                              </td>
                              <td className="qc-td">
                                <span className="font-serif italic font-bold text-gray-900 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-xs inline-block">
                                  {item.organism}
                                </span>
                              </td>
                              <td className="qc-td text-center whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-orange-100 text-orange-900 border border-orange-200">
                                  {item.occurrences}
                                </span>
                              </td>
                              <td className="qc-td">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-semibold text-gray-500 mr-1">
                                    {item.roomCount} {item.roomCount === 1 ? "room" : "rooms"}:
                                  </span>
                                  {item.rooms.map((rm) => (
                                    <span
                                      key={rm}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-gray-700 bg-gray-100 border border-gray-200"
                                    >
                                      {rm}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 2: Microorganism Occurrence by Room */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          Microorganism Occurrence by Room
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Identifies which microorganisms repeatedly appear in the same cleanroom environment.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-gray-500">
                        {occurrencesByRoom.length} room-organism pair(s)
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="qc-table">
                        <thead>
                          <tr>
                            <th scope="col" className="qc-th">Room</th>
                            <th scope="col" className="qc-th">Microorganism</th>
                            <th scope="col" className="qc-th text-center w-36">Occurrences</th>
                          </tr>
                        </thead>
                        <tbody>
                          {occurrencesByRoom.map((item) => (
                            <tr key={`${item.room}:::${item.organism}`}>
                              <td className="qc-td">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-gray-900">{item.room}</span>
                                  {item.room_grade && (
                                    <span className="text-[10px] px-1 py-0.2 bg-gray-100 text-gray-600 rounded font-semibold border border-gray-200">
                                      Gr {item.room_grade}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="qc-td">
                                <span className="font-serif italic font-semibold text-gray-900">
                                  {item.organism}
                                </span>
                              </td>
                              <td className="qc-td text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <span className="font-mono font-bold text-gray-900 text-xs">
                                    {item.occurrences}
                                  </span>
                                  {item.occurrences > 1 && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold tracking-tight">
                                      Recurring ({item.occurrences}x)
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3: Occurrence by Parameter */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <Layers className="w-4 h-4 text-emerald-600" />
                          Occurrence by Parameter
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Breakdown across sampling methods: 부유균 (Airborne), 낙하균 (Settle Plate), and 표면균 (Surface).
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-gray-500">
                        {occurrencesByParameter.length} distinct organism(s)
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="qc-table">
                        <thead>
                          <tr>
                            <th scope="col" className="qc-th">Microorganism</th>
                            <th scope="col" className="qc-th text-center w-28">부유균</th>
                            <th scope="col" className="qc-th text-center w-28">낙하균</th>
                            <th scope="col" className="qc-th text-center w-28">표면균</th>
                            <th scope="col" className="qc-th text-center w-28 bg-orange-50/60 text-orange-900">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {occurrencesByParameter.map((item) => (
                            <tr key={item.organism}>
                              <td className="qc-td">
                                <span className="font-serif italic font-semibold text-gray-900">
                                  {item.organism}
                                </span>
                              </td>
                              <td className="qc-td text-center font-mono">
                                {item.airborne > 0 ? (
                                  <span className="font-bold text-gray-900">{item.airborne}</span>
                                ) : (
                                  <span className="text-gray-300">0</span>
                                )}
                              </td>
                              <td className="qc-td text-center font-mono">
                                {item.settle > 0 ? (
                                  <span className="font-bold text-gray-900">{item.settle}</span>
                                ) : (
                                  <span className="text-gray-300">0</span>
                                )}
                              </td>
                              <td className="qc-td text-center font-mono">
                                {item.surface > 0 ? (
                                  <span className="font-bold text-gray-900">{item.surface}</span>
                                ) : (
                                  <span className="text-gray-300">0</span>
                                )}
                              </td>
                              <td className="qc-td text-center font-mono bg-orange-50/40">
                                <span className="font-extrabold text-orange-950 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded">
                                  {item.total}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Microorganism Manual Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-orange-600" />
                  Edit Microorganism Identification
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Update third-party laboratory identification results
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isSaving}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Record Context Card */}
            <div className="p-5 border-b border-gray-100 bg-orange-50/30">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Room</span>
                  <span className="font-bold text-gray-900">
                    {editingRecord.room_name || "-"}
                    {editingRecord.room_grade && (
                      <span className="ml-1 text-[10px] px-1 py-0.2 bg-gray-100 text-gray-600 rounded font-semibold border border-gray-200">
                        Gr {editingRecord.room_grade}
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">EM Date</span>
                  <span className="font-mono font-semibold text-gray-800">{editingRecord.measurement_date || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Parameter</span>
                  <span className="font-semibold text-orange-800">{editingRecord.parameter_name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">OOS Result</span>
                  <span className="font-mono font-bold text-red-600">
                    {editingRecord.result} {getDisplayUnit(editingRecord)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Body / Form Fields */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveModal();
              }}
              className="p-5 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              {/* Field 1: Sample Submission Date */}
              <div>
                <label className="qc-label">
                  Sample Submission Date
                </label>
                <input
                  type="date"
                  value={editSubmissionDate}
                  onChange={(e) => setEditSubmissionDate(e.target.value)}
                  className="qc-input"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Date when the test sample was sent to the testing laboratory
                </p>
              </div>

              {/* Field 2: Microorganism ID Status */}
              <div>
                <label className="qc-label">
                  Microorganism ID Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={editIdStatus}
                  onChange={(e) => handleStatusChange(e.target.value as MicroorganismStatus)}
                  className="qc-select font-medium"
                >
                  <option value="NOT ENTERED">NOT ENTERED</option>
                  <option value="IDENTIFIED">IDENTIFIED</option>
                  <option value="NOT IDENTIFIED">NOT IDENTIFIED</option>
                </select>
                <div className="mt-1 text-[11px]">
                  {editIdStatus === "NOT ENTERED" && (
                    <span className="text-gray-500">
                      Third-party laboratory identification result has not yet been entered.
                    </span>
                  )}
                  {editIdStatus === "IDENTIFIED" && (
                    <span className="text-emerald-700 font-medium">
                      Third-party laboratory successfully identified the organism(s).
                    </span>
                  )}
                  {editIdStatus === "NOT IDENTIFIED" && (
                    <span className="text-amber-700 font-medium">
                      Laboratory attempted identification, but microorganism was unidentifiable.
                    </span>
                  )}
                </div>
              </div>

              {/* Field 3: Microorganism Names (show only when status = IDENTIFIED) */}
              {editIdStatus === "IDENTIFIED" && (
                <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <label className="qc-label">
                      Microorganism Name(s) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-gray-500 font-medium">
                      {editOrganismNames.filter((n) => n.trim().length > 0).length} organism(s)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {editOrganismNames.map((name, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-gray-400 w-5 text-right shrink-0">
                          #{index + 1}
                        </span>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => handleEditOrganismName(index, e.target.value)}
                            placeholder="e.g. Staphylococcus aureus, Bacillus subtilis..."
                            className={cn(
                              "qc-input font-serif italic",
                              validationError && !name.trim() && editOrganismNames.filter((n) => n.trim()).length === 0
                                ? "border-red-500 focus:ring-red-500"
                                : ""
                            )}
                            autoFocus={index === editOrganismNames.length - 1 && index > 0}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveOrganism(index)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded border border-gray-200 hover:border-red-200 transition-colors cursor-pointer shrink-0"
                          title="Remove this microorganism"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Another Microorganism button */}
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleAddOrganismName}
                      className="btn-secondary text-orange-700 bg-orange-50 hover:bg-orange-100 hover:text-orange-800 border-orange-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Another Microorganism
                    </button>
                    <p className="text-[10px] text-gray-400">
                      Enter identified genus, species, or code
                    </p>
                  </div>
                </div>
              )}

              {/* Validation Error Message */}
              {validationError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={isSaving}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Identification
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Remove Single Organism Confirmation Prompt */}
          {deleteConfirmIndex !== null && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-60 p-4">
              <div className="bg-white rounded-xl shadow-2xl border border-red-200 max-w-sm w-full p-5 space-y-3 animate-in fade-in zoom-in-95">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-full text-red-600 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Remove Microorganism?</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Are you sure you want to remove{" "}
                      {editOrganismNames[deleteConfirmIndex]?.trim() ? (
                        <span className="font-bold text-gray-900 italic font-serif">
                          "{editOrganismNames[deleteConfirmIndex]}"
                        </span>
                      ) : (
                        <span className="font-semibold text-gray-800">this microorganism entry</span>
                      )}
                      ?
                    </p>
                  </div>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-600">
                  <span className="font-semibold text-gray-700">Note:</span> This only removes the microorganism entry from this list. The original EM measurement record will NOT be deleted.
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelRemoveOrganism}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRemoveOrganism}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded shadow-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Microorganism
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Change Status Confirmation Prompt */}
          {statusChangeConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-60 p-4">
              <div className="bg-white rounded-xl shadow-2xl border border-amber-200 max-w-sm w-full p-5 space-y-3 animate-in fade-in zoom-in-95">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-full text-amber-700 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Change Status & Clear Names?</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Changing status to{" "}
                      <span className="font-bold text-amber-800">
                        {statusChangeConfirm.pendingStatus}
                      </span>{" "}
                      will clear the {editOrganismNames.filter((n) => n.trim().length > 0).length} entered microorganism name(s).
                    </p>
                  </div>
                </div>
                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-900">
                  Are you sure you want to switch status and discard these identified names?
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelStatusChange}
                    className="btn-secondary"
                  >
                    Keep Identified Status
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmStatusChange}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded shadow-xs transition-colors cursor-pointer"
                  >
                    Confirm & Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


