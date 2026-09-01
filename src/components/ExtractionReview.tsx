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
      <div className="qc-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Extraction Summary
          </h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExport}
              disabled={rooms.length === 0}
              className="btn-secondary disabled:opacity-50"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              Export to Excel
            </button>
            <button
              onClick={() => onConfirm(rooms)}
              disabled={rooms.length === 0 || editingRoomId !== null}
              className="btn-primary disabled:opacity-50"
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              Confirm Import to EM Data
            </button>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-6 text-sm">
          <div>
            <p className="qc-label">Filename</p>
            <p className="font-medium text-gray-900 truncate" title={result.filename}>{result.filename}</p>
          </div>
          <div>
            <p className="qc-label">Pages Processed</p>
            <p className="font-medium text-gray-900 font-mono">{result.processedPages} / {result.totalPages}</p>
          </div>
          <div>
            <p className="qc-label">Rooms Detected</p>
            <p className="font-medium text-gray-900 font-mono">{rooms.length}</p>
          </div>
          <div>
            <p className="qc-label">Measurements Extracted</p>
            <p className="font-medium text-gray-900 font-mono">
              {rooms.reduce((acc, r) => acc + Object.keys(r.parameters).length, 0)}
            </p>
          </div>
          <div>
             <p className="qc-label">Review Status</p>
             {rooms.some(r => r.conclusion === 'REVIEW REQUIRED') ? (
                <span className="status-badge status-oos">Review Required</span>
             ) : (
                <span className="status-badge status-action">Ready</span>
             )}
          </div>
        </div>
      </div>

      {/* Review Table */}
      <div className="qc-card overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Review Extracted Rooms
          </h3>
        </div>
        
        <div className="p-6 overflow-x-auto">
          {rooms.length === 0 ? (
            <div className="text-center py-12 border border-gray-200 rounded-xl bg-gray-50/50">
              <AlertCircle className="mx-auto h-8 w-8 text-orange-400 mb-3" />
              <p className="text-sm font-semibold text-gray-700">No valid Environmental Monitoring measurements were detected.</p>
              <p className="text-xs text-gray-500 mt-1">The file has not been accepted. Please review or reprocess the PDF.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-x-auto h-full bg-white">
              <table className="qc-table min-w-[1000px]">
                <thead>
                  <tr>
                    <th scope="col" className="qc-th">Grade</th>
                    <th scope="col" className="qc-th">Room</th>
                    {paramsList.map(p => (
                      <th key={p} scope="col" className="qc-th">{p}</th>
                    ))}
                    <th scope="col" className="qc-th">Method</th>
                    <th scope="col" className="qc-th">Date</th>
                    <th scope="col" className="qc-th">Conclusion</th>
                    <th scope="col" className="qc-th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => {
                    const isEditing = editingRoomId === room.id;
                    const rData = isEditing ? (editForm as RoomGroup) : room;
                    const currentGrade = rData.manual_grade || rData.room_grade;

                    return (
                      <tr key={room.id} className={isEditing ? "bg-orange-50/30" : "hover:bg-gray-50/50"}>
                        {/* Grade */}
                        <td className="qc-td align-top">
                          {isEditing ? (
                             <select 
                               className="qc-select !py-1 !text-xs w-16"
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
                        <td className="qc-td align-top">
                          {isEditing ? (
                             <input 
                               type="text" 
                               className="qc-input !py-1 !text-xs w-28" 
                               value={rData.room_name || ''} 
                               onChange={e => setEditForm({...editForm, room_name: e.target.value})} 
                             />
                          ) : (
                             <span className="font-semibold text-gray-900">{rData.room_name}</span>
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
                            <td key={param} className="qc-td align-top min-w-[120px]">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <input 
                                    type="number" 
                                    placeholder="Val"
                                    className="qc-input !py-0.5 !text-xs w-full font-mono" 
                                    value={pResult !== null ? pResult : ''} 
                                    onChange={e => handleParamEdit(param, 'result', e.target.value ? Number(e.target.value) : null)} 
                                  />
                                  <select 
                                    className="qc-select !py-0.5 !text-[11px] w-full"
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
                                     <span className={`font-bold font-mono ${colorClass}`}>{pResult}</span>
                                  ) : (
                                     <span className="text-gray-300">-</span>
                                  )}
                                  {pStatus && pStatus !== 'NOT APPLICABLE' && (
                                     <span className="text-[10px] text-gray-500 font-semibold">{pStatus}</span>
                                  )}
                                  {pStatus === 'NOT APPLICABLE' && (
                                     <span className="text-[10px] text-gray-400 italic">N/A</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Method */}
                        <td className="qc-td align-top">
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                            {(Object.values(room.parameters)[0] as ExtractedRecord | undefined)?.extraction_method || 'GEMINI'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="qc-td align-top font-mono">
                          {isEditing ? (
                             <input 
                               type="text" 
                               className="qc-input !py-1 !text-xs w-24 font-mono" 
                               value={rData.measurement_date || ''} 
                               onChange={e => setEditForm({...editForm, measurement_date: e.target.value})} 
                             />
                          ) : (
                             <span className="text-gray-600">{rData.measurement_date}</span>
                          )}
                        </td>

                        {/* Conclusion */}
                        <td className="qc-td align-top">
                           {isEditing ? (
                              <select 
                                className="qc-select !py-1 !text-xs w-full font-bold"
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
                        <td className="qc-td align-top text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={saveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                <Save size={16} />
                              </button>
                              <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(room)} className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors">
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
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-200 flex justify-end gap-3">
            <button 
              onClick={onCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              onClick={() => onConfirm(rooms)}
              disabled={editingRoomId !== null}
              className="btn-primary disabled:opacity-50"
            >
              Confirm Import to EM Data
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
