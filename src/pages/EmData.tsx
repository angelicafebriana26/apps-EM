import React, { useEffect, useState, useMemo } from "react";
import { Database, Search, Download, Edit2, Save, X, Trash2, Loader2, Filter, RotateCcw, AlertTriangle } from "lucide-react";
import { getEMMeasurements, EMMeasurementRecord, deleteMeasurement, updateMeasurement, deleteDocumentAndMeasurements, deleteMeasurementsBatch, getDocumentInfo } from "../services/emDatabaseService";
import { RoomGroup, ExtractedRecord } from "../types";
import { exportToExcel } from "../lib/exportUtils";
import { evaluateParameterStatus, evaluateRoomConclusion } from "../lib/emCriteriaConfig";

function evaluateRoomState(room: RoomGroup): RoomGroup {
  const grade = room.manual_grade || room.room_grade;
  const statuses: string[] = [];
  
  const newParams = { ...room.parameters };
      
  for (const param of Object.keys(newParams)) {
    const record = newParams[param];
    if (!record.manual_status) {
      record.status = evaluateParameterStatus(grade, record.parameter, record.result);
    }
    statuses.push(record.manual_status || record.status || 'REVIEW REQUIRED');
  }
  
  let newConclusion = room.conclusion;
  if (!room.manual_conclusion) {
     newConclusion = evaluateRoomConclusion(statuses);
  } else {
     newConclusion = room.manual_conclusion;
  }
  
  return {
    ...room,
    parameters: newParams,
    conclusion: newConclusion
  };
}

function parseDateParts(dateStr?: string | null) {
  if (!dateStr) return { year: '', month: '', day: '', raw: '' };
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) {
    return {
      year: match[1],
      month: match[2].padStart(2, '0'),
      day: match[3].padStart(2, '0'),
      raw: clean
    };
  }
  const yearMatch = clean.match(/\b(20\d{2})\b/);
  return {
    year: yearMatch ? yearMatch[1] : '',
    month: '',
    day: '',
    raw: clean
  };
}

export function EmData() {
  const [measurements, setMeasurements] = useState<EMMeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Filter States
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterRoom, setFilterRoom] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterConclusion, setFilterConclusion] = useState("");
  
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RoomGroup>>({});
  
  const [roomToDelete, setRoomToDelete] = useState<RoomGroup | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<{ loading: boolean; error: string | null; success: boolean }>({ loading: false, error: null, success: false });

  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [docToDeleteInfo, setDocToDeleteInfo] = useState<{ filename: string; dates: string; roomCount: number; measurementCount: number } | null>(null);
  const [docDeleteStatus, setDocDeleteStatus] = useState<{ loading: boolean; error: string | null; success: boolean }>({ loading: false, error: null, success: false });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const data = await getEMMeasurements();
      setMeasurements(data || []);
    } catch (err: any) {
      console.error("Failed to load EM data:", err);
      setDbError(err?.message || "Failed to load records from Firestore.");
    } finally {
      setLoading(false);
    }
  };

  // Group measurements by room_name + measurement_date + document_id
  const groupedRooms = useMemo(() => {
    const groups: Record<string, RoomGroup> = {};
    measurements.forEach(m => {
      const key = `${m.document_id || 'doc'}_${m.measurement_date || 'nodate'}_${m.room_name || 'noroom'}`;
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
          document_id: m.document_id
        };
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
        extraction_method: m.extraction_method
      } as ExtractedRecord;
    });
    return Object.values(groups);
  }, [measurements]);

  // Extract distinct filter options
  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    groupedRooms.forEach(r => {
      const { year } = parseDateParts(r.measurement_date);
      if (year) years.add(year);
    });
    return Array.from(years).sort().reverse();
  }, [groupedRooms]);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    groupedRooms.forEach(r => {
      const { month } = parseDateParts(r.measurement_date);
      if (month) months.add(month);
    });
    return Array.from(months).sort();
  }, [groupedRooms]);

  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    groupedRooms.forEach(r => {
      if (r.measurement_date) dates.add(r.measurement_date);
    });
    return Array.from(dates).sort().reverse();
  }, [groupedRooms]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set<string>();
    groupedRooms.forEach(r => {
      if (r.room_name) rooms.add(r.room_name);
    });
    return Array.from(rooms).sort();
  }, [groupedRooms]);

  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    groupedRooms.forEach(r => {
      const grade = r.manual_grade || r.room_grade;
      if (grade) grades.add(grade);
    });
    return Array.from(grades).sort();
  }, [groupedRooms]);

  // Multi-criteria Filtering
  const filteredRooms = useMemo(() => {
    return groupedRooms.filter(r => {
      const { year, month } = parseDateParts(r.measurement_date);
      const grade = (r.manual_grade || r.room_grade || "").toUpperCase();

      // Search keyword filter
      if (search) {
        const query = search.toLowerCase();
        const matchesRoom = r.room_name?.toLowerCase().includes(query);
        const matchesDate = r.measurement_date?.toLowerCase().includes(query);
        const matchesGrade = grade.toLowerCase().includes(query);
        const matchesConclusion = r.conclusion?.toLowerCase().includes(query);
        if (!matchesRoom && !matchesDate && !matchesGrade && !matchesConclusion) {
          return false;
        }
      }

      // Year filter
      if (filterYear && year !== filterYear) return false;

      // Month filter
      if (filterMonth && month !== filterMonth) return false;

      // Exact Date filter
      if (filterDate && r.measurement_date !== filterDate) return false;

      // Room filter
      if (filterRoom && r.room_name !== filterRoom) return false;

      // Grade filter
      if (filterGrade && grade !== filterGrade.toUpperCase()) return false;

      // Conclusion filter
      if (filterConclusion && r.conclusion !== filterConclusion) return false;

      return true;
    });
  }, [groupedRooms, search, filterYear, filterMonth, filterDate, filterRoom, filterGrade, filterConclusion]);

  const hasActiveFilters = Boolean(
    search || filterYear || filterMonth || filterDate || filterRoom || filterGrade || filterConclusion
  );

  const resetFilters = () => {
    setSearch("");
    setFilterYear("");
    setFilterMonth("");
    setFilterDate("");
    setFilterRoom("");
    setFilterGrade("");
    setFilterConclusion("");
  };

  const startEdit = (room: RoomGroup) => {
    setEditingRoomId(room.id);
    setEditForm(JSON.parse(JSON.stringify(room)));
  };

  const handleParamEdit = (paramName: string, field: string, value: any) => {
    if (!editForm.parameters) return;
    const newParams = { ...editForm.parameters };
    if (!newParams[paramName]) {
      newParams[paramName] = {
        parameter: paramName,
        result: null,
        status: null,
        extraction_method: 'MANUAL_EDIT'
      } as any;
    }
    newParams[paramName] = {
      ...newParams[paramName],
      [field]: value
    };
    setEditForm({ ...editForm, parameters: newParams });
  };

  const saveEdit = async () => {
    if (!editForm || !editingRoomId) return;

    try {
      const evaluated = evaluateRoomState(editForm as RoomGroup);

      for (const paramName of Object.keys(evaluated.parameters)) {
        const param = evaluated.parameters[paramName];
        if (param.id) {
          await updateMeasurement(param.id, {
            room_name: evaluated.room_name || null,
            room_grade: evaluated.manual_grade || evaluated.room_grade || null,
            measurement_date: evaluated.measurement_date || null,
            result: param.result,
            calculated_status: param.status || null,
            final_status: param.manual_status || param.status || null,
            room_conclusion: evaluated.conclusion || null
          });
        }
      }

      setEditingRoomId(null);
      await loadData();
    } catch (e) {
      console.error("Failed to update measurement:", e);
      alert("Failed to save changes to Firestore.");
    }
  };

  const deleteRoom = (room: RoomGroup) => {
    setRoomToDelete(room);
    setDeleteStatus({ loading: false, error: null, success: false });
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    
    setDeleteStatus({ loading: true, error: null, success: false });

    try {
      const idsToDelete: string[] = [];
      for (const paramName of Object.keys(roomToDelete.parameters)) {
        const param = roomToDelete.parameters[paramName];
        if (param.id) {
          idsToDelete.push(param.id);
        }
      }
      
      if (idsToDelete.length > 0) {
        await deleteMeasurementsBatch(idsToDelete);
      }
      
      await loadData();
      setDeleteStatus({ loading: false, error: null, success: true });
      setTimeout(() => {
        setRoomToDelete(null);
        setDeleteStatus(prev => ({ ...prev, success: false }));
      }, 1500);
    } catch (e) {
      console.error("Failed to delete room:", e);
      setDeleteStatus({ loading: false, error: "Failed to delete records.", success: false });
    }
  };

  const requestDeleteDocument = async (docId: string) => {
    setDocToDelete(docId);
    setDocDeleteStatus({ loading: true, error: null, success: false });
    
    try {
      const docInfo = await getDocumentInfo(docId);
      const filename = docInfo?.filename || 'Unknown Document';
      
      const roomsFromDoc = groupedRooms.filter(r => r.document_id === docId);
      const datesSet = new Set<string>();
      let measurementCount = 0;
      
      roomsFromDoc.forEach(r => {
        if (r.measurement_date) datesSet.add(r.measurement_date);
        measurementCount += Object.keys(r.parameters).length;
      });
      
      setDocToDeleteInfo({
        filename,
        dates: Array.from(datesSet).join(', ') || 'Unknown Date',
        roomCount: roomsFromDoc.length,
        measurementCount
      });
      
      setDocDeleteStatus({ loading: false, error: null, success: false });
    } catch (err) {
      console.error("Failed to load doc info:", err);
      setDocDeleteStatus({ loading: false, error: "Failed to load document info.", success: false });
    }
  };

  const confirmDeleteDocument = async () => {
    if (!docToDelete) return;
    
    setDocDeleteStatus({ loading: true, error: null, success: false });

    try {
      await deleteDocumentAndMeasurements(docToDelete);
      await loadData();
      
      setDocDeleteStatus({ loading: false, error: null, success: true });
      setTimeout(() => {
        setDocToDelete(null);
        setDocToDeleteInfo(null);
        setDocDeleteStatus(prev => ({ ...prev, success: false }));
      }, 2000);
    } catch (e) {
      console.error("Failed to delete document:", e);
      setDocDeleteStatus({ loading: false, error: "DELETE FAILED", success: false });
    }
  };

  const handleExportFiltered = () => {
    const filename = `EM_Database_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportToExcel(filteredRooms, filename);
  };

  const paramsList = [
    "부유입자 ≥0.5 μm",
    "부유입자 ≥5.0 μm",
    "부유균",
    "낙하균",
    "표면균"
  ];

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'PASS': return 'text-gray-900 font-bold';
      case 'ALERT': return 'text-blue-600 font-bold';
      case 'ACTION': return 'text-emerald-600 font-bold';
      case 'OOS': return 'text-red-600 font-extrabold';
      case 'REVIEW REQUIRED': return 'text-amber-600 font-bold';
      default: return 'text-gray-400';
    }
  };

  const getConclusionBadge = (conclusion?: string | null) => {
    switch (conclusion) {
      case 'PASS':
        return <span className="status-pass">PASS</span>;
      case 'ALERT':
        return <span className="status-alert">ALERT</span>;
      case 'ACTION':
        return <span className="status-action">ACTION</span>;
      case 'OOS':
        return <span className="status-oos">OOS</span>;
      case 'REVIEW REQUIRED':
        return <span className="status-review">REVIEW REQUIRED</span>;
      default:
        return <span className="status-pass">{conclusion || 'PASS'}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="qc-card !p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-600" />
            Environmental Monitoring Database
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Persistent storage of all imported and validated Environmental Monitoring measurements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search rooms, dates, grade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="qc-input !pl-9"
            />
          </div>

          <button
            onClick={handleExportFiltered}
            disabled={filteredRooms.length === 0}
            className="btn-primary"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel ({filteredRooms.length})
          </button>
        </div>
      </div>

      {dbError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{dbError}</span>
          </div>
          <button onClick={loadData} className="font-bold underline uppercase text-[10px] cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Multi-Criteria Filter Card */}
      <div className="qc-filter-card">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
            <Filter className="w-3.5 h-3.5 text-orange-600" />
            <span>Filter Criteria</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 items-end">
          {/* Year Filter */}
          <div>
            <label className="qc-filter-label">Year</label>
            <select 
              value={filterYear} 
              onChange={e => setFilterYear(e.target.value)}
              className="qc-select"
            >
              <option value="">All Years</option>
              {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="qc-filter-label">Month</label>
            <select 
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)}
              className="qc-select"
            >
              <option value="">All Months</option>
              {uniqueMonths.map(m => <option key={m} value={m}>{m} ({Number(m)}월)</option>)}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="qc-filter-label">Date</label>
            <select 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)}
              className="qc-select"
            >
              <option value="">All Dates</option>
              {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <label className="qc-filter-label">Room</label>
            <select 
              value={filterRoom} 
              onChange={e => setFilterRoom(e.target.value)}
              className="qc-select"
            >
              <option value="">All Rooms</option>
              {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="qc-filter-label">Grade</label>
            <select 
              value={filterGrade} 
              onChange={e => setFilterGrade(e.target.value)}
              className="qc-select"
            >
              <option value="">All Grades</option>
              {uniqueGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="qc-filter-label">Conclusion</label>
            <select 
              value={filterConclusion}
              onChange={e => setFilterConclusion(e.target.value)}
              className="qc-select"
            >
              <option value="">All Statuses</option>
              <option value="PASS">PASS</option>
              <option value="ALERT">ALERT</option>
              <option value="ACTION">ACTION</option>
              <option value="OOS">OOS</option>
              <option value="REVIEW REQUIRED">REVIEW REQUIRED</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1.5 text-gray-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Active filters applied: <strong className="text-gray-900">{filteredRooms.length}</strong> of {groupedRooms.length} rooms matched
            </span>
          </div>
        )}
      </div>

      {/* Data Table Card */}
      <div className="qc-card !p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-orange-500 rounded-full"></span>
            <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">
              Cleanroom Monitoring Records ({filteredRooms.length})
            </h3>
          </div>
          <span className="text-[11px] text-gray-500">
            Showing {filteredRooms.length} of {groupedRooms.length} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[960px]">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-3.5 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px] w-16">Grade</th>
                <th scope="col" className="px-3.5 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px] w-36">Room</th>
                {paramsList.map(p => (
                  <th key={p} scope="col" className="px-3.5 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px]">{p}</th>
                ))}
                <th scope="col" className="px-3.5 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px] w-28">Date</th>
                <th scope="col" className="px-3.5 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px] w-28">Conclusion</th>
                <th scope="col" className="px-3.5 py-2.5 font-bold text-gray-600 uppercase tracking-wider text-[10px] text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <Loader2 className="mx-auto h-8 w-8 text-orange-500 mb-3 animate-spin" />
                    <p className="text-sm font-semibold text-gray-400 italic">Loading database records...</p>
                  </td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <Database className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-gray-600">
                      {hasActiveFilters ? "No records match the selected filters." : "No Environmental Monitoring data found in Firestore."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="mt-3 btn-secondary"
                      >
                        Reset Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => {
                  const isEditing = editingRoomId === room.id;
                  const displayRoom = isEditing ? (editForm as RoomGroup) : room;

                  return (
                    <tr key={room.id} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="px-3.5 py-3 align-top font-bold text-gray-800">
                        {isEditing ? (
                          <input type="text" className="w-12 qc-input !h-7 !p-1 text-xs" value={displayRoom.manual_grade || displayRoom.room_grade || ''} onChange={e => setEditForm({...editForm, manual_grade: e.target.value})} />
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[11px] font-bold border border-gray-200">
                            Gr {displayRoom.manual_grade || displayRoom.room_grade || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 align-top font-semibold text-gray-900">
                        {isEditing ? (
                          <input type="text" className="w-full qc-input !h-7 !p-1 text-xs" value={displayRoom.room_name || ''} onChange={e => setEditForm({...editForm, room_name: e.target.value})} />
                        ) : (
                          <span className="text-gray-900">{displayRoom.room_name || '-'}</span>
                        )}
                      </td>
                      
                      {paramsList.map(paramName => {
                        const param = displayRoom.parameters[paramName];
                        const paramStatus = param?.manual_status || param?.status || null;
                        
                        return (
                          <td key={paramName} className="px-3.5 py-3 align-top">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 min-w-[80px]">
                                <input
                                  type="number"
                                  className="w-full qc-input !h-7 !p-1 text-xs"
                                  placeholder="Value"
                                  value={param?.result !== null && param?.result !== undefined ? param.result : ''}
                                  onChange={e => handleParamEdit(paramName, 'result', e.target.value ? Number(e.target.value) : null)}
                                />
                                <select 
                                  className="w-full qc-select !h-7 !py-0.5 !text-[10px]"
                                  value={paramStatus || ''}
                                  onChange={e => handleParamEdit(paramName, 'manual_status', e.target.value)}
                                >
                                  <option value="">Auto</option>
                                  <option value="PASS">PASS</option>
                                  <option value="ALERT">ALERT</option>
                                  <option value="ACTION">ACTION</option>
                                  <option value="OOS">OOS</option>
                                </select>
                              </div>
                            ) : (
                              param && param.result !== null && param.result !== undefined ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-xs">{param.result}</span>
                                  <span className={`text-[10px] mt-0.5 ${getStatusColor(paramStatus)}`}>
                                    {paramStatus}
                                  </span>
                                </div>
                              ) : <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-3.5 py-3 align-top text-gray-600 text-xs whitespace-nowrap">
                        {isEditing ? (
                          <input type="text" className="w-24 qc-input !h-7 !p-1 text-xs" value={displayRoom.measurement_date || ''} onChange={e => setEditForm({...editForm, measurement_date: e.target.value})} />
                        ) : (
                          displayRoom.measurement_date || '-'
                        )}
                      </td>

                      <td className="px-3.5 py-3 align-top">
                        {getConclusionBadge(displayRoom.conclusion)}
                      </td>

                      <td className="px-3.5 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer" title="Save & Recalculate">
                                <Save className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingRoomId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer" title="Cancel">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(room)} className="p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded transition-colors cursor-pointer" title="Edit">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteRoom(room)} className="p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors cursor-pointer" title="Delete Room">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {room.document_id && (
                                <button onClick={() => requestDeleteDocument(room.document_id!)} className="p-1 text-gray-400 hover:bg-red-50 hover:text-red-900 rounded transition-colors cursor-pointer" title="Delete Entire Source Document">
                                  <Database className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
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
      
      {/* Delete Confirmation Modal */}
      {roomToDelete && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this EM data row?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently remove this room's Environmental Monitoring results for the selected measurement date.
            </p>
            
            {deleteStatus.error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                {deleteStatus.error}
              </div>
            )}
            
            {deleteStatus.success ? (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded border border-emerald-200 font-medium">
                EM data deleted successfully.
              </div>
            ) : (
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRoomToDelete(null)}
                  disabled={deleteStatus.loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRoom}
                  disabled={deleteStatus.loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {deleteStatus.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Delete Document Confirmation Modal */}
      {docToDelete && docToDeleteInfo && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete entire source document?</h3>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4 text-sm">
              <p className="font-semibold text-gray-900 truncate mb-1" title={docToDeleteInfo.filename}>{docToDeleteInfo.filename}</p>
              <div className="grid grid-cols-2 gap-2 text-gray-600 mt-2 text-xs">
                <div><span className="font-semibold text-gray-700">Date(s):</span> {docToDeleteInfo.dates}</div>
                <div><span className="font-semibold text-gray-700">Rooms:</span> {docToDeleteInfo.roomCount}</div>
                <div className="col-span-2"><span className="font-semibold text-gray-700">Measurements:</span> {docToDeleteInfo.measurementCount}</div>
              </div>
            </div>
            
            <p className="text-sm text-red-600 font-medium mb-6">
              Warning: This will permanently delete all Environmental Monitoring data imported from this source document. This action cannot be undone.
            </p>
            
            {docDeleteStatus.error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200 font-bold">
                {docDeleteStatus.error}
              </div>
            )}
            
            {docDeleteStatus.success ? (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded border border-emerald-200 font-medium">
                Source document and all associated EM data deleted successfully.
              </div>
            ) : (
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDocToDelete(null)}
                  disabled={docDeleteStatus.loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteDocument}
                  disabled={docDeleteStatus.loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {docDeleteStatus.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Entire Source Data'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
