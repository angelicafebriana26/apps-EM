import React, { useEffect, useState, useMemo } from "react";
import { Database, Search, Download, Edit2, Save, X, Trash2, Loader2 } from "lucide-react";
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

export function EmData() {
  const [measurements, setMeasurements] = useState<EMMeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRoom, setFilterRoom] = useState("");
  const [filterConclusion, setFilterConclusion] = useState("");
  
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RoomGroup>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getEMMeasurements();
      setMeasurements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Group measurements by room_name + measurement_date
  const groupedRooms = useMemo(() => {
    const groups: Record<string, RoomGroup> = {};
    measurements.forEach(m => {
      const key = `${m.measurement_date || 'unknown'}_${m.room_name}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          measurement_date: m.measurement_date || "",
          room_name: m.room_name || "",
          room_grade: m.room_grade || "",
          manual_grade: m.room_grade || "",
          parameters: {},
          conclusion: m.room_conclusion || "PASS",
          document_id: m.document_id // Used to delete the whole document if needed
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

  // Apply filters
  const filteredRooms = useMemo(() => {
    return groupedRooms.filter(room => {
      if (search && !room.room_name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRoom && room.room_name !== filterRoom) return false;
      if (filterConclusion && room.conclusion !== filterConclusion) return false;
      return true;
    });
  }, [groupedRooms, search, filterRoom, filterConclusion]);

  const uniqueRooms = useMemo(() => Array.from(new Set(groupedRooms.map(r => r.room_name))).filter(Boolean), [groupedRooms]);

  const handleExport = () => {
    exportToExcel(filteredRooms, "EM_Data_Export.xlsx");
  };

  const startEdit = (room: RoomGroup) => {
    setEditingRoomId(room.id);
    setEditForm(JSON.parse(JSON.stringify(room)));
  };

  const handleParamEdit = (paramName: string, field: keyof ExtractedRecord, value: any) => {
    setEditForm(prev => {
      const current = prev.parameters ? prev.parameters[paramName] : null;
      if (!current) {
        return {
          ...prev,
          parameters: {
            ...(prev.parameters || {}),
            [paramName]: {
              id: Math.random().toString(), // temp ID
              measurement_date: prev.measurement_date || null,
              room_name: prev.room_name || null,
              room_grade: prev.manual_grade || prev.room_grade || null,
              parameter: paramName,
              result: null,
              unit: null,
              alert_limit: null,
              action_limit: null,
              status: null,
              manual_status: null,
              source_page: null,
              [field]: value
            }
          }
        };
      }
      return {
        ...prev,
        parameters: {
          ...prev.parameters,
          [paramName]: { ...current, [field]: value }
        }
      };
    });
  };

  const saveEdit = async () => {
    if (!editingRoomId || !editForm) return;
    
    // Recalculate
    const updatedRoom = evaluateRoomState(editForm as RoomGroup);

    try {
      // Find all measurements that belong to this room
      const promises: Promise<void>[] = [];

      Object.values(updatedRoom.parameters).forEach(param => {
        if (!param) return;
        
        let parameterCode = param.parameter;
        if (param.parameter === '부유입자 ≥0.5 μm') parameterCode = 'PARTICLE_0_5';
        if (param.parameter === '부유입자 ≥5.0 μm') parameterCode = 'PARTICLE_5_0';
        if (param.parameter === '부유균') parameterCode = 'AIRBORNE_VIABLE';
        if (param.parameter === '낙하균') parameterCode = 'SETTLE_PLATE';
        if (param.parameter === '표면균') parameterCode = 'SURFACE_CONTACT';

        // Check if measurement ID exists in our loaded state
        const exists = measurements.some(m => m.measurement_id === param.id);

        if (exists) {
          promises.push(updateMeasurement(param.id, {
            room_grade: updatedRoom.manual_grade || updatedRoom.room_grade || null,
            room_name: updatedRoom.room_name || null,
            measurement_date: updatedRoom.measurement_date || null,
            result: param.result !== undefined ? param.result : null,
            final_status: param.manual_status || param.status || null,
            calculated_status: param.status || null,
            room_conclusion: updatedRoom.conclusion || null,
          }));
        } else {
          // In a real app we might insert a new record if the param didn't exist before
          // but for now we focus on updating existing records.
        }
      });

      await Promise.all(promises);
      
      // Reload from DB
      await loadData();
      setEditingRoomId(null);
    } catch (err) {
      console.error('Failed to save edit', err);
      alert('Failed to save edit to the database.');
    }
  };

  const deleteRoom = async (room: RoomGroup) => {
    if (window.confirm(`Are you sure you want to delete all measurements for room ${room.room_name}?`)) {
      try {
        const promises = Object.values(room.parameters)
          .filter(p => !!p && !!p.id)
          .map(p => deleteMeasurement(p!.id));
        await Promise.all(promises);
        await loadData();
      } catch (err) {
        console.error('Failed to delete room', err);
        alert('Failed to delete.');
      }
    }
  };
  
  const deleteDocument = async (documentId: string) => {
    if (window.confirm(`Are you sure you want to completely delete the entire document and all its measurements?`)) {
      try {
        await deleteDocumentAndMeasurements(documentId);
        await loadData();
      } catch (err) {
        console.error('Failed to delete document', err);
        alert('Failed to delete document.');
      }
    }
  };

  const paramsList = ['부유입자 ≥0.5 μm', '부유입자 ≥5.0 μm', '부유균', '낙하균', '표면균'];

  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'PASS': return 'text-gray-900';
      case 'ALERT': return 'text-blue-600 font-bold';
      case 'ACTION': return 'text-green-600 font-bold';
      case 'OOS': return 'text-red-600 font-bold';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      {/* Header & Controls */}
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Environmental Monitoring Records
          </h3>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search rooms..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="block w-full rounded border border-gray-200 pl-10 focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 bg-white"
              />
            </div>
            <button 
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-[10px] uppercase tracking-widest rounded border border-green-200 transition-colors"
            >
              <Download className="mr-2 h-3 w-3" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <select 
            value={filterRoom} 
            onChange={e => setFilterRoom(e.target.value)}
            className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white"
          >
            <option value="">All Rooms</option>
            {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select 
            value={filterConclusion}
            onChange={e => setFilterConclusion(e.target.value)}
            className="block w-full rounded border border-gray-200 py-2 pl-3 pr-10 text-xs text-gray-600 focus:border-orange-500 focus:outline-none focus:ring-orange-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="PASS">Pass</option>
            <option value="ALERT">Alert</option>
            <option value="ACTION">Action</option>
            <option value="OOS">OOS</option>
            <option value="REVIEW REQUIRED">Review Required</option>
          </select>
          <button onClick={loadData} className="inline-flex items-center justify-center px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-[10px] uppercase tracking-widest rounded border border-gray-200 transition-colors">
            Refresh Data
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="border border-gray-100 rounded-lg overflow-hidden h-full">
          <table className="w-full text-xs text-left relative">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
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
                    <Loader2 className="mx-auto h-8 w-8 text-blue-500 mb-3 animate-spin" />
                    <p className="text-sm font-semibold text-gray-400 italic">Loading database records...</p>
                  </td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <Database className="mx-auto h-10 w-10 text-gray-200 mb-3" />
                    <p className="text-sm font-semibold text-gray-400 italic">No Environmental Monitoring data found.</p>
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
