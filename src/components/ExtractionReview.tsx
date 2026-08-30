import React, { useState, useMemo, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, Edit2, Save, X, Info } from 'lucide-react';
import { DocumentExtractionResult, ExtractedRecord, RoomGroup } from '../types';
import { exportToExcel } from '../lib/exportUtils';
import { evaluateParameterStatus, evaluateRoomConclusion, getStatusColor, emCriteriaMaster } from '../lib/emCriteriaConfig';

interface Props {
  result: DocumentExtractionResult;
  onConfirm: (rooms: RoomGroup[]) => void;
  onCancel: () => void;
}

export default function ExtractionReview({ result, onConfirm, onCancel }: Props) {
  const [rooms, setRooms] = useState<RoomGroup[]>([]);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RoomGroup>>({});

  // Initialize grouping once
  useEffect(() => {
    const grouped: Record<string, RoomGroup> = {};
    
    result.records.forEach(record => {
      if (!record.room_name) return;
      const key = `${record.measurement_date || 'unknown'}_${record.room_name}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          measurement_date: record.measurement_date,
          room_name: record.room_name,
          room_grade: record.room_grade,
          parameters: {},
          source_page: record.source_page,
          conclusion: 'REVIEW REQUIRED'
        };
      }
      if (record.parameter) {
        grouped[key].parameters[record.parameter] = { ...record };
      }
    });

    // Evaluate initial statuses
    const initialRooms = Object.values(grouped).map(room => evaluateRoomState(room));
    setRooms(initialRooms);
  }, [result.records]);

  function evaluateRoomState(room: RoomGroup): RoomGroup {
    const grade = room.manual_grade || room.room_grade;
    const statuses: string[] = [];

    // Clone parameters to prevent mutation
    const newParams = { ...room.parameters };
    
    for (const param of Object.keys(newParams)) {
      const record = newParams[param];
      // Only evaluate if not manually overridden
      if (!record.manual_status) {
        record.status = evaluateParameterStatus(grade, record.parameter, record.result);
      }
      statuses.push(record.manual_status || record.status || 'REVIEW REQUIRED');
    }

    // Auto-conclusion
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

  const startEdit = (room: RoomGroup) => {
    setEditingRoomId(room.id);
    // deep clone for editing
    setEditForm(JSON.parse(JSON.stringify(room)));
  };

  const handleParamEdit = (paramName: string, field: keyof ExtractedRecord, value: any) => {
    setEditForm(prev => {
      const current = prev.parameters ? prev.parameters[paramName] : null;
      if (!current) {
        // Create parameter if it was missing
        return {
          ...prev,
          parameters: {
            ...(prev.parameters || {}),
            [paramName]: {
              id: Math.random().toString(),
              measurement_date: prev.measurement_date || null,
              room_name: prev.room_name || null,
              room_grade: prev.manual_grade || prev.room_grade || null,
              parameter: paramName,
              result: null,
              unit: null,
              alert_limit: null,
              action_limit: null,
              status: null,
              source_page: prev.source_page || null,
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

  const saveEdit = () => {
    if (!editingRoomId || !editForm) return;
    
    setRooms(prev => prev.map(r => {
      if (r.id === editingRoomId) {
        // Apply edits and re-evaluate
        return evaluateRoomState(editForm as RoomGroup);
      }
      return r;
    }));
    setEditingRoomId(null);
  };

  const cancelEdit = () => {
    setEditingRoomId(null);
  };

  const handleExport = () => {
    const filename = `EM_Extraction_${result.filename.replace('.pdf', '')}.xlsx`;
    exportToExcel(rooms, filename);
  };

  const paramsList = ['부유입자 ≥0.5 μm', '부유입자 ≥5.0 μm', '부유균', '낙하균', '표면균'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Document Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Extraction Summary
          </h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExport}
              disabled={rooms.length === 0}
              className="inline-flex items-center px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-[10px] uppercase tracking-widest rounded border border-green-200 transition-colors disabled:opacity-50"
            >
              <Download className="mr-2 h-3 w-3" />
              Export to Excel
            </button>
            <button
              onClick={() => onConfirm(rooms)}
              disabled={rooms.length === 0 || editingRoomId !== null}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-widest rounded shadow transition-colors disabled:opacity-50"
            >
              <CheckCircle className="mr-2 h-3 w-3" />
              Confirm Import to EM Data
            </button>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-6 text-sm">
          <div>
            <p className="text-gray-400 font-semibold mb-1 text-xs uppercase tracking-wider">Filename</p>
            <p className="font-medium text-gray-900 truncate" title={result.filename}>{result.filename}</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-1 text-xs uppercase tracking-wider">Pages Processed</p>
            <p className="font-medium text-gray-900">{result.processedPages} / {result.totalPages}</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-1 text-xs uppercase tracking-wider">Rooms Detected</p>
            <p className="font-medium text-gray-900">{rooms.length}</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-1 text-xs uppercase tracking-wider">Measurements Extracted</p>
            <p className="font-medium text-gray-900">
              {rooms.reduce((acc, r) => acc + Object.keys(r.parameters).length, 0)}
            </p>
          </div>
          <div>
             <p className="text-gray-400 font-semibold mb-1 text-xs uppercase tracking-wider">Review Status</p>
             {rooms.some(r => r.conclusion === 'REVIEW REQUIRED') ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-50 text-orange-600 font-bold text-[10px] tracking-wider uppercase">Review Required</span>
             ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-600 font-bold text-[10px] tracking-wider uppercase">Ready</span>
             )}
          </div>
        </div>
      </div>

      {/* Review Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Review Extracted Rooms
          </h3>
        </div>
        
        <div className="p-6 overflow-x-auto">
          {rooms.length === 0 ? (
            <div className="text-center py-12 border border-gray-100 rounded-lg bg-gray-50/50">
              <AlertCircle className="mx-auto h-8 w-8 text-orange-400 mb-3" />
              <p className="text-sm font-semibold text-gray-700">No valid Environmental Monitoring measurements were detected.</p>
              <p className="text-xs text-gray-500 mt-1">The file has not been accepted. Please review or reprocess the PDF.</p>
            </div>
          ) : (
            <div className="border border-gray-100 rounded-lg overflow-x-auto h-full">
              <table className="w-full text-xs text-left relative min-w-[1000px]">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Room</th>
                    {paramsList.map(p => (
                      <th key={p} scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">{p}</th>
                    ))}
                            <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Conclusion</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {rooms.map((room) => {
                    const isEditing = editingRoomId === room.id;
                    const rData = isEditing ? (editForm as RoomGroup) : room;
                    const currentGrade = rData.manual_grade || rData.room_grade;

                    return (
                      <tr key={room.id} className={isEditing ? "bg-orange-50/30" : "hover:bg-gray-50/50"}>
                        {/* Grade */}
                        <td className="px-3 py-3 align-top">
                          {isEditing ? (
                             <select 
                               className="p-1 border border-orange-300 rounded text-xs bg-white w-14"
                               value={rData.manual_grade || rData.room_grade || ''}
                               onChange={e => setEditForm({...editForm, manual_grade: e.target.value})}
                             >
                               <option value="">?</option>
                               <option value="A">A</option>
                               <option value="B">B</option>
                               <option value="C">C</option>
                               <option value="D">D</option>
                             </select>
                          ) : (
                             <span className={`font-bold ${!currentGrade ? 'text-orange-500' : 'text-gray-900'}`}>
                               {currentGrade || '?'}
                             </span>
                          )}
                        </td>

                        {/* Room */}
                        <td className="px-3 py-3 align-top">
                          {isEditing ? (
                             <input 
                               type="text" 
                               className="w-24 p-1 border border-orange-300 rounded text-xs" 
                               value={rData.room_name || ''} 
                               onChange={e => setEditForm({...editForm, room_name: e.target.value})} 
                             />
                          ) : (
                             <span className="font-medium text-gray-900">{rData.room_name}</span>
                          )}
                        </td>

                        {/* Parameters */}
                        {paramsList.map(param => {
                          const pRecord = rData.parameters[param];
                          const hasRecord = !!pRecord;
                          const pResult = hasRecord ? pRecord.result : null;
                          const pStatus = hasRecord ? (pRecord.manual_status || pRecord.status) : null;
                          const colorClass = getStatusColor(pStatus);

                          return (
                            <td key={param} className="px-3 py-3 align-top min-w-[120px]">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <input 
                                    type="number" 
                                    placeholder="Val"
                                    className="w-full p-1 border border-orange-300 rounded text-xs" 
                                    value={pResult !== null ? pResult : ''} 
                                    onChange={e => handleParamEdit(param, 'result', e.target.value ? Number(e.target.value) : null)} 
                                  />
                                  <select 
                                    className="w-full p-1 border border-orange-300 rounded text-[10px] bg-white text-gray-600"
                                    value={pRecord?.manual_status || pRecord?.status || ''}
                                    onChange={e => handleParamEdit(param, 'manual_status', e.target.value)}
                                  >
                                    <option value="">Auto</option>
                                    <option value="PASS">PASS</option>
                                    <option value="ALERT">ALERT</option>
                                    <option value="ACTION">ACTION</option>
                                    <option value="OOS">OOS</option>
                                    <option value="NOT APPLICABLE">N/A</option>
                                    <option value="REVIEW REQUIRED">REVIEW</option>
                                  </select>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  {pResult !== null ? (
                                     <span className={`font-bold ${colorClass}`}>{pResult}</span>
                                  ) : (
                                     <span className="text-gray-300">-</span>
                                  )}
                                  {pStatus && pStatus !== 'NOT APPLICABLE' && (
                                     <span className="text-[9px] text-gray-500 font-semibold">{pStatus}</span>
                                  )}
                                  {pStatus === 'NOT APPLICABLE' && (
                                     <span className="text-[9px] text-gray-400 italic">N/A</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Method */}
                        <td className="px-3 py-3 align-top">
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {Object.values(room.parameters)[0]?.extraction_method || 'GEMINI'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-3 py-3 align-top">
                          {isEditing ? (
                             <input 
                               type="text" 
                               className="w-20 p-1 border border-orange-300 rounded text-xs" 
                               value={rData.measurement_date || ''} 
                               onChange={e => setEditForm({...editForm, measurement_date: e.target.value})} 
                             />
                          ) : (
                             <span className="text-gray-600">{rData.measurement_date}</span>
                          )}
                        </td>

                        {/* Conclusion */}
                        <td className="px-3 py-3 align-top">
                           {isEditing ? (
                              <select 
                                className="w-full p-1 border border-orange-300 rounded text-xs bg-white font-bold"
                                value={rData.manual_conclusion || rData.conclusion || ''}
                                onChange={e => setEditForm({...editForm, manual_conclusion: e.target.value})}
                              >
                                <option value="">Auto</option>
                                <option value="PASS">PASS</option>
                                <option value="ALERT">ALERT</option>
                                <option value="ACTION">ACTION</option>
                                <option value="OOS">OOS</option>
                                <option value="REVIEW REQUIRED">REVIEW REQUIRED</option>
                              </select>
                           ) : (
                              <span className={`font-bold ${getStatusColor(rData.manual_conclusion || rData.conclusion)}`}>
                                {rData.manual_conclusion || rData.conclusion}
                              </span>
                           )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 align-top text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <Save size={16} />
                              </button>
                              <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(room)} className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors">
                              <Edit2 size={16} />
                            </button>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {rooms.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button 
              onClick={onCancel}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onConfirm(rooms)}
              disabled={editingRoomId !== null}
              className="px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Confirm Import to EM Data
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
