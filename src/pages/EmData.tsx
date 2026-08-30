import React, { useEffect, useState, useMemo } from "react";
import { Database, Search, Download, Edit2, Save, X, Trash2, Loader2, Filter, RotateCcw, AlertTriangle } from "lucide-react";
import { getEMMeasurements, EMMeasurementRecord, deleteMeasurement, updateMeasurement, deleteDocumentAndMeasurements } from "../services/emDatabaseService";
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

  const deleteRoom = async (room: RoomGroup) => {
    if (!window.confirm(`Are you sure you want to delete measurements for ${room.room_name || 'this room'} on ${room.measurement_date || 'this date'}?`)) {
      return;
    }

    try {
      for (const paramName of Object.keys(room.parameters)) {
        const param = room.parameters[paramName];
        if (param.id) {
          await deleteMeasurement(param.id);
        }
      }
      await loadData();
    } catch (e) {
      console.error("Failed to delete room:", e);
      alert("Failed to delete records.");
    }
  };

  const deleteDocument = async (docId: string) => {
    if (!window.confirm("Are you sure you want to delete all measurements from this source PDF document?")) {
      return;
    }

    try {
      await deleteDocumentAndMeasurements(docId);
      await loadData();
    } catch (e) {
      console.error("Failed to delete document:", e);
      alert("Failed to delete source document records.");
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
      case 'PASS': return 'text-green-600 font-semibold';
      case 'ALERT': return 'text-yellow-600 font-bold';
      case 'ACTION': return 'text-orange-600 font-bold';
      case 'OOS': return 'text-red-600 font-extrabold';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-w-0">
      {/* Top Action Bar */}
      <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-500" />
            Environmental Monitoring Database
          </h2>
          <p className="text-xs text-gray-400">
            Persistent storage of all imported and validated Environmental Monitoring measurements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search rooms, dates, grade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded text-xs focus:border-orange-500 focus:outline-none bg-white"
            />
          </div>

          <button
            onClick={handleExportFiltered}
            disabled={filteredRooms.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel ({filteredRooms.length})
          </button>
        </div>
      </div>

      {dbError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{dbError}</span>
          </div>
          <button onClick={loadData} className="font-bold underline uppercase text-[10px]">
            Retry
          </button>
        </div>
      )}

      {/* Multi-Criteria Filter Bar */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 items-center">
          {/* Year Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Year</label>
            <select 
              value={filterYear} 
              onChange={e => setFilterYear(e.target.value)}
              className="block w-full rounded border border-gray-200 py-1.5 pl-2.5 pr-8 text-xs text-gray-700 focus:border-orange-500 focus:ring-orange-500 bg-white"
            >
              <option value="">All Years</option>
              {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Month</label>
            <select 
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)}
              className="block w-full rounded border border-gray-200 py-1.5 pl-2.5 pr-8 text-xs text-gray-700 focus:border-orange-500 focus:ring-orange-500 bg-white"
            >
              <option value="">All Months</option>
              {uniqueMonths.map(m => <option key={m} value={m}>{m} ({Number(m)}월)</option>)}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
            <select 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)}
              className="block w-full rounded border border-gray-200 py-1.5 pl-2.5 pr-8 text-xs text-gray-700 focus:border-orange-500 focus:ring-orange-500 bg-white"
            >
              <option value="">All Dates</option>
              {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Room</label>
            <select 
              value={filterRoom} 
              onChange={e => setFilterRoom(e.target.value)}
              className="block w-full rounded border border-gray-200 py-1.5 pl-2.5 pr-8 text-xs text-gray-700 focus:border-orange-500 focus:ring-orange-500 bg-white"
            >
              <option value="">All Rooms</option>
              {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Grade</label>
            <select 
              value={filterGrade} 
              onChange={e => setFilterGrade(e.target.value)}
              className="block w-full rounded border border-gray-200 py-1.5 pl-2.5 pr-8 text-xs text-gray-700 focus:border-orange-500 focus:ring-orange-500 bg-white"
            >
              <option value="">All Grades</option>
              {uniqueGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Conclusion</label>
            <select 
              value={filterConclusion}
              onChange={e => setFilterConclusion(e.target.value)}
              className="block w-full rounded border border-gray-200 py-1.5 pl-2.5 pr-8 text-xs text-gray-700 focus:border-orange-500 focus:ring-orange-500 bg-white"
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
          <div className="mt-2.5 flex items-center justify-between text-xs text-gray-500 bg-orange-50/70 px-3 py-1.5 rounded border border-orange-200/60">
            <span className="flex items-center gap-1.5 text-orange-800 font-medium">
              <Filter className="w-3.5 h-3.5 text-orange-600" />
              Active filters applied ({filteredRooms.length} of {groupedRooms.length} rooms matched)
            </span>
            <button
              onClick={resetFilters}
              className="text-[10px] font-bold text-orange-700 hover:text-orange-900 uppercase tracking-wider underline cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="p-6">
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider w-16">Grade</th>
                <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider w-32">Room</th>
                {paramsList.map(p => (
                  <th key={p} scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">{p}</th>
                ))}
                <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider w-24">Date</th>
                <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider w-24">Conclusion</th>
                <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
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
                    <Database className="mx-auto h-10 w-10 text-gray-200 mb-3" />
                    <p className="text-sm font-semibold text-gray-400 italic">
                      {hasActiveFilters ? "No records match the selected filters." : "No Environmental Monitoring data found in Firestore."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="mt-3 inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[10px] uppercase tracking-wider rounded"
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
                    <tr key={room.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-3 py-3 align-top font-bold text-gray-700">
                        {isEditing ? (
                          <input type="text" className="w-10 border rounded p-1 text-xs" value={displayRoom.manual_grade || displayRoom.room_grade || ''} onChange={e => setEditForm({...editForm, manual_grade: e.target.value})} />
                        ) : (
                          displayRoom.manual_grade || displayRoom.room_grade || '-'
                        )}
                      </td>
                      <td className="px-3 py-3 align-top font-medium text-gray-900">
                        {isEditing ? (
                          <input type="text" className="w-full border rounded p-1 text-xs" value={displayRoom.room_name || ''} onChange={e => setEditForm({...editForm, room_name: e.target.value})} />
                        ) : (
                          displayRoom.room_name || '-'
                        )}
                      </td>
                      
                      {paramsList.map(paramName => {
                        const param = displayRoom.parameters[paramName];
                        const paramStatus = param?.manual_status || param?.status || null;
                        
                        return (
                          <td key={paramName} className="px-3 py-3 align-top">
                            {isEditing ? (
                              <div className="flex flex-col gap-1 min-w-[80px]">
                                <input
                                  type="number"
                                  className="w-full border rounded p-1 text-xs"
                                  placeholder="Value"
                                  value={param?.result !== null && param?.result !== undefined ? param.result : ''}
                                  onChange={e => handleParamEdit(paramName, 'result', e.target.value ? Number(e.target.value) : null)}
                                />
                                <select 
                                  className="w-full border rounded p-1 text-[10px]"
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
                              param && param.result !== null ? (
                                <div className="flex flex-col">
                                  <span className="font-mono">{param.result}</span>
                                  <span className={`text-[10px] ${getStatusColor(paramStatus)}`}>
                                    {paramStatus}
                                  </span>
                                </div>
                              ) : <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-3 py-3 align-top text-gray-500 whitespace-nowrap">
                        {isEditing ? (
                          <input type="text" className="w-20 border rounded p-1 text-xs" value={displayRoom.measurement_date || ''} onChange={e => setEditForm({...editForm, measurement_date: e.target.value})} />
                        ) : (
                          displayRoom.measurement_date || '-'
                        )}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex px-2 py-1 rounded font-bold text-[10px] uppercase tracking-wider ${
                          displayRoom.conclusion === 'PASS' ? 'bg-gray-100 text-gray-700' :
                          displayRoom.conclusion === 'OOS' ? 'bg-red-100 text-red-700' :
                          displayRoom.conclusion === 'REVIEW REQUIRED' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {displayRoom.conclusion}
                        </span>
                      </td>

                      <td className="px-3 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Save & Recalculate">
                                <Save className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingRoomId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(room)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 rounded transition-colors" title="Edit">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteRoom(room)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors" title="Delete Room">
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {room.document_id && (
                                <button onClick={() => deleteDocument(room.document_id!)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-900 rounded transition-colors" title="Delete Entire Source Document">
                                  <Database className="w-4 h-4" />
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
    </div>
  );
}
