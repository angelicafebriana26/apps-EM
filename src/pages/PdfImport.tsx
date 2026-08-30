import React, { useRef, useState } from "react";
import { UploadCloud, FileText, AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { DocumentExtractionResult, ExtractionBatch, ExtractedRecord, RoomGroup } from "../types";
import ExtractionReview from "../components/ExtractionReview";
import { useImportStore } from "../store/importStore";
import { checkDuplicateDocument, importEMData, DocumentMetadata, EMMeasurementRecord } from "../services/emDatabaseService";
import { Link } from "react-router-dom";

export function PdfImport() {
  const { fileBuffer, fileName, uploading, result, reviewMode, setFileDetails, setUploading, setResult, setReviewMode, clearImport } = useImportStore();
  
  const [importingToDb, setImportingToDb] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Create a pseudo-file for extractPageLocally
  const getFile = () => (fileBuffer && fileName) ? new File([fileBuffer], fileName, { type: 'application/pdf' }) : null;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const arrayBuffer = await selectedFile.arrayBuffer();
    setFileDetails(selectedFile.name, arrayBuffer);
    startProcess(selectedFile);
  };

  const safeJsonParse = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON response. Response starts with:", text.substring(0, 100));
      // If we got HTML despite a 200 OK, it's almost certainly a proxy redirect (e.g. session expired)
      if (text.trim().toLowerCase().startsWith('<!doctype html') || text.includes('<html')) {
        throw new Error("Session expired or request intercepted by proxy. Please refresh the page and try again.");
      }
      throw new Error("Invalid response format from server. The server may have crashed.");
    }
  };

  const startProcess = async (selectedFile: File) => {
    setUploading(true);
    setResult(null);
    setReviewMode(false);

    try {
      // 1. Upload & count pages
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
         throw new Error(`Failed to upload document (HTTP ${uploadRes.status})`);
      }
      
      const { uploadId, totalPages, filename } = await safeJsonParse(uploadRes);

      // 2. Prepare single-page batches
      const batches: ExtractionBatch[] = [];
      for (let i = 1; i <= totalPages; i++) {
        batches.push({
          id: `batch-${i}`,
          startPage: i,
          endPage: i,
          status: 'pending',
          recordsExtracted: 0
        });
      }

      let currentResult: DocumentExtractionResult = {
        uploadId,
        filename,
        totalPages,
        processedPages: 0,
        roomsDetected: 0,
        recordsExtracted: 0,
        status: 'processing',
        batches,
        records: [],
        warnings: []
      };

      setResult(currentResult);

      // 3. Process batches sequentially
      let allRecords: ExtractedRecord[] = [];
      let hasFailedBatch = false;

      // Ensure we have access to extractPageLocally
      const { extractPageLocally } = await import('../lib/extractor');

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // Update batch status to processing
        currentResult = {
          ...currentResult,
          batches: currentResult.batches.map(b => b.id === batch.id ? { ...b, status: 'processing' } : b)
        };
        setResult(currentResult);

        try {
          const localResult = await extractPageLocally(selectedFile, batch.startPage);
          
          let records = [];
          
          if (localResult.confidence === 'HIGH') {
            records = localResult.records;
          } else {
            // GEMINI_FALLBACK
            const batchRes = await fetch('/api/extract-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uploadId, startPage: batch.startPage, endPage: batch.endPage })
            });

            if (!batchRes.ok) {
              let errData = {};
              try { errData = await safeJsonParse(batchRes); } catch (e) {}
              
              const errorType = (errData as any).errorType || 'UNKNOWN_ERROR';
              if (errorType === 'GEMINI_QUOTA_ERROR') {
                // Generate a placeholder record to allow manual review
                records = [{
                  measurement_date: null,
                  room_name: `Page ${batch.startPage} (Unextracted)`,
                  room_grade: null,
                  parameter: '부유입자 ≥0.5 μm', // Needs at least one param to show up in the table
                  result: null,
                  unit: null,
                  alert_limit: null,
                  action_limit: null,
                  status: 'REVIEW REQUIRED',
                  source_page: batch.startPage,
                  extraction_method: 'GEMINI_FALLBACK'
                }];
                // We don't throw, we let it pass as completed but with a placeholder
              } else {
                throw new Error(JSON.stringify({
                   errorType: errorType,
                   errorMessage: (errData as any).error || `Batch ${batch.id} failed with status ${batchRes.status}`
                }));
              }
            } else {
              const json = await safeJsonParse(batchRes);
              records = json.records.map((r: any) => ({
                ...r,
                extraction_method: 'GEMINI_FALLBACK'
              }));
            }
          }

          // Assign IDs to records
          const recordsWithIds = records.map((r: any) => ({
            ...r,
            id: Math.random().toString(36).substr(2, 9)
          }));

          allRecords = [...allRecords, ...recordsWithIds];

          currentResult = {
            ...currentResult,
            processedPages: Math.min(currentResult.processedPages + (batch.endPage - batch.startPage + 1), totalPages),
            recordsExtracted: allRecords.length,
            records: allRecords,
            batches: currentResult.batches.map(b => b.id === batch.id ? { ...b, status: 'completed', recordsExtracted: recordsWithIds.length } : b)
          };
          setResult(currentResult);
        } catch (error: any) {
          hasFailedBatch = true;
          let parsedError = { errorType: 'UNKNOWN_ERROR', errorMessage: 'Failed to extract' };
          try {
             parsedError = JSON.parse(error.message);
          } catch(e) {}
          
          currentResult = {
            ...currentResult,
            batches: currentResult.batches.map(b => b.id === batch.id ? { 
               ...b, 
               status: 'failed', 
               errorType: parsedError.errorType,
               errorMessage: parsedError.errorMessage
            } : b)
          };
          setResult(currentResult);
        }
      }

      // 4. Finalize
      currentResult = {
        ...currentResult,
        status: hasFailedBatch ? 'incomplete' : 'extracted',
        roomsDetected: new Set(allRecords.map(r => r.room_name).filter(Boolean)).size,
      };
      setResult(currentResult);
      setUploading(false);
      
      // Auto-open review if finished
      if (!hasFailedBatch) {
        setReviewMode(true);
      }

    } catch (error: any) {
      console.error(error);
      setUploading(false);
      // Give a better error message if it's a network error
      const errorMessage = error?.message === "Failed to fetch" 
         ? "Network error: Failed to reach the server. It might be restarting. Please try again."
         : error?.message || "An unknown error occurred.";
         
      setResult(prev => prev ? { 
         ...prev, 
         status: 'failed',
         error: errorMessage
      } : null);
      
      // If there is no previous result to attach the error to, we should ideally show it somewhere.
      // But for now, we just rely on the existing UI.
      if (!result) {
         alert(`Upload failed: ${errorMessage}`);
      }
    }
  };

  const retryBatch = async (batchToRetry: ExtractionBatch) => {
    if (!result) return;
    
    // Set to processing
    let currentResult: DocumentExtractionResult = {
      ...result,
      status: 'processing',
      batches: result.batches.map(b => b.id === batchToRetry.id ? { ...b, status: 'processing', errorType: undefined, errorMessage: undefined } : b)
    };
    setResult(currentResult);

    try {
      const batchRes = await fetch('/api/extract-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: result.uploadId, startPage: batchToRetry.startPage, endPage: batchToRetry.endPage })
      });

      let recordsToAdd = [];

      if (!batchRes.ok) {
         let errData = {};
         try { errData = await safeJsonParse(batchRes); } catch (e) {}
         
         const errorType = (errData as any).errorType || 'UNKNOWN_ERROR';
         if (errorType === 'GEMINI_QUOTA_ERROR') {
            recordsToAdd = [{
               measurement_date: null,
               room_name: `Page ${batchToRetry.startPage} (Unextracted)`,
               room_grade: null,
               parameter: '부유입자 ≥0.5 μm',
               result: null,
               unit: null,
               alert_limit: null,
               action_limit: null,
               status: 'REVIEW REQUIRED',
               source_page: batchToRetry.startPage,
               extraction_method: 'GEMINI_FALLBACK'
            }];
         } else {
            throw new Error(JSON.stringify({
               errorType: errorType,
               errorMessage: (errData as any).error || `Batch failed with status ${batchRes.status}`
            }));
         }
      } else {
         const { records } = await safeJsonParse(batchRes);
         recordsToAdd = records.map((r: any) => ({
           ...r,
           extraction_method: 'GEMINI_FALLBACK'
         }));
      }

      const recordsWithIds = recordsToAdd.map((r: any) => ({
        ...r,
        id: Math.random().toString(36).substr(2, 9)
      }));

      const newRecords = [...currentResult.records, ...recordsWithIds];

      currentResult = {
        ...currentResult,
        processedPages: Math.min(currentResult.processedPages + (batchToRetry.endPage - batchToRetry.startPage + 1), currentResult.totalPages),
        recordsExtracted: newRecords.length,
        records: newRecords,
        batches: currentResult.batches.map(b => b.id === batchToRetry.id ? { ...b, status: 'completed', recordsExtracted: recordsWithIds.length } : b)
      };
    } catch (error: any) {
      let parsedError = { errorType: 'UNKNOWN_ERROR', errorMessage: 'Failed to extract' };
      try { parsedError = JSON.parse(error.message); } catch(e) {}
      
      currentResult = {
        ...currentResult,
        batches: currentResult.batches.map(b => b.id === batchToRetry.id ? { 
           ...b, 
           status: 'failed', 
           errorType: parsedError.errorType,
           errorMessage: parsedError.errorMessage
        } : b)
      };
    }

    // Finalize
    const stillHasFailed = currentResult.batches.some(b => b.status === 'failed');
    currentResult = {
      ...currentResult,
      status: stillHasFailed ? 'incomplete' : 'extracted',
      roomsDetected: new Set(currentResult.records.map(r => r.room_name).filter(Boolean)).size,
    };
    setResult(currentResult);
    
    if (!stillHasFailed) {
      setReviewMode(true);
    }
  };

  const handleReviewConfirm = async (rooms: RoomGroup[]) => {
    if (!result || !fileName) return;

    setImportingToDb(true);
    setImportError(null);

    try {
      // 1. Check duplicate
      const { isDuplicate } = await checkDuplicateDocument(fileName);
      if (isDuplicate) {
        if (!window.confirm(`This PDF (${fileName}) appears to have already been imported. Do you want to proceed and import it again?`)) {
          setImportingToDb(false);
          return;
        }
      }

      // 2. Prepare metadata
      const documentMetadata: DocumentMetadata = {
        document_id: result.uploadId,
        filename: fileName,
        page_count: result.totalPages,
        room_count: rooms.length,
        measurement_count: rooms.reduce((acc, r) => acc + Object.keys(r.parameters).length, 0),
        imported_at: null, // assigned in service
        processing_status: 'IMPORTED'
      };

      // 3. Prepare measurement records from confirmed rooms
      const measurements: EMMeasurementRecord[] = [];
      rooms.forEach(room => {
        Object.values(room.parameters).forEach(param => {
          if (!param) return;
          
          let parameterCode = param.parameter;
          if (param.parameter === '부유입자 ≥0.5 μm') parameterCode = 'PARTICLE_0_5';
          if (param.parameter === '부유입자 ≥5.0 μm') parameterCode = 'PARTICLE_5_0';
          if (param.parameter === '부유균') parameterCode = 'AIRBORNE_VIABLE';
          if (param.parameter === '낙하균') parameterCode = 'SETTLE_PLATE';
          if (param.parameter === '표면균') parameterCode = 'SURFACE_CONTACT';

          measurements.push({
            measurement_id: Math.random().toString(36).substr(2, 9),
            document_id: documentMetadata.document_id,
            measurement_date: room.measurement_date || null,
            room_grade: room.manual_grade || room.room_grade || null,
            room_name: room.room_name || null,
            parameter_code: parameterCode,
            parameter_name: param.parameter,
            result: param.result !== undefined ? param.result : null,
            unit: param.unit || null,
            alert_limit: param.alert_limit || null,
            action_limit: param.action_limit || null,
            acceptance_criteria: null, // Will add if needed
            calculated_status: param.status || null,
            final_status: param.manual_status || param.status || null,
            room_conclusion: room.conclusion || null,
            source_page: param.source_page || null,
            extraction_method: param.extraction_method || null
          });
        });
      });

      // 4. Save to Firestore
      await importEMData(documentMetadata, measurements);

      // 5. Update state
      setResult({ ...result, status: 'imported' } as DocumentExtractionResult & {status: string});
      setImportSuccess(true);
      setReviewMode(false);
      
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportError(err.message || 'Failed to save data to the database.');
    } finally {
      setImportingToDb(false);
    }
  };

  if (importSuccess) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete</h2>
        <p className="text-gray-500 mb-8">
          Successfully imported measurements into EM Data.
        </p>
        <div className="flex justify-center gap-4">
          <button 
            onClick={() => {
              setImportSuccess(false);
              clearImport();
            }}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm uppercase tracking-wider rounded transition-colors"
          >
            Import Another PDF
          </button>
          <Link 
            to="/em-data"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm uppercase tracking-wider rounded shadow transition-colors"
          >
            View EM Data
          </Link>
        </div>
      </div>
    );
  }

  if (reviewMode && result) {
    return (
      <div className="relative">
        {importingToDb && (
          <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="font-bold text-blue-900 uppercase tracking-widest text-sm">Saving to Database...</p>
            </div>
          </div>
        )}
        {importError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Import Failed</p>
              <p className="text-sm">{importError}</p>
              <button 
                onClick={() => setImportError(null)}
                className="mt-2 text-xs font-bold uppercase tracking-wider bg-white px-3 py-1 rounded border border-red-200 hover:bg-red-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <ExtractionReview result={result} onConfirm={handleReviewConfirm} onCancel={() => setReviewMode(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upload Area */}
      <div 
        className="bg-white rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="application/pdf" 
          className="hidden" 
        />
        {uploading ? (
          <Loader2 className="mx-auto h-12 w-12 text-orange-500 mb-4 animate-spin" />
        ) : (
          <UploadCloud className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        )}
        <h3 className="text-lg font-medium text-gray-700 mb-2">
          {uploading ? 'Processing PDF Document...' : 'Drag Environmental Monitoring CoA PDF files here'}
        </h3>
        <p className="text-sm text-gray-400 mb-6 italic">
          {uploading ? 'Extracting via Gemini AI in batches...' : 'Supports text and scanned PDFs.'}
        </p>
        <button 
          type="button" 
          disabled={uploading}
          className="inline-flex items-center px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-[10px] uppercase tracking-widest rounded border border-gray-200 transition-colors disabled:opacity-50"
        >
          {uploading ? 'Extracting...' : 'Select PDF Files'}
        </button>
      </div>

      {/* File Processing Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Processing Queue
          </h3>
          {result?.status === 'incomplete' && (
             <button 
                onClick={() => setReviewMode(true)}
                className="inline-flex items-center px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded font-bold text-[10px] uppercase tracking-widest hover:bg-red-100 transition-colors"
             >
               Review Required
             </button>
          )}
          {result?.status === 'extracted' && (
             <button 
                onClick={() => setReviewMode(true)}
                className="inline-flex items-center px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded font-bold text-[10px] uppercase tracking-widest hover:bg-orange-100 transition-colors"
             >
               Open Review
             </button>
          )}
        </div>
        <div className="p-6">
          <div className="border border-gray-100 rounded-lg overflow-hidden h-full">
            <table className="w-full text-xs text-left relative">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">File Name</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Batches</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Rooms Detected</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Records Extracted</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {!result ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center">
                      <FileText className="mx-auto h-8 w-8 text-gray-200 mb-3" />
                      <p className="text-sm font-semibold text-gray-400 italic">No files in queue</p>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td className="px-3 py-3 font-medium text-gray-900">{result.filename}</td>
                    <td className="px-3 py-3">
                      {result.batches.length} ({result.totalPages} pages)
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 transition-all duration-300" 
                            style={{ width: `${(result.processedPages / result.totalPages) * 100}%` }}
                          />
                        </div>
                        <span className="text-gray-500">{Math.round((result.processedPages / result.totalPages) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">{result.roomsDetected || '-'}</td>
                    <td className="px-3 py-3">{result.recordsExtracted}</td>
                    <td className="px-3 py-3 text-right">
                      {result.status === 'processing' && <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-600 font-bold text-[10px] tracking-wider uppercase"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</span>}
                      {result.status === 'extracted' && <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-600 font-bold text-[10px] tracking-wider uppercase"><CheckCircle className="w-3 h-3 mr-1" /> Extracted</span>}
                      {result.status === 'incomplete' && <span className="inline-flex items-center px-2 py-1 rounded bg-red-50 text-red-600 font-bold text-[10px] tracking-wider uppercase"><AlertCircle className="w-3 h-3 mr-1" /> Incomplete</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Batch Status Details */}
          {result && result.batches.length > 0 && (
            <div className="mt-4 border border-gray-100 rounded-lg p-4 bg-gray-50/50">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Batch Processing Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.batches.map(batch => (
                  <div key={batch.id} className={`p-3 border rounded text-[10px] flex flex-col justify-between ${
                    batch.status === 'completed' ? 'bg-white border-green-200 text-gray-600' :
                    batch.status === 'processing' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    batch.status === 'failed' ? 'bg-red-50 border-red-200 text-red-700' :
                    'bg-white border-gray-200 text-gray-400'
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                       <span className="font-semibold tracking-wider text-xs">Pages {batch.startPage}-{batch.endPage}</span>
                       {batch.status === 'completed' && <span className="font-bold">{batch.recordsExtracted} records</span>}
                       {batch.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                       {batch.status === 'failed' && <span className="font-bold text-red-600">FAILED</span>}
                       {batch.status === 'pending' && <span className="italic">Waiting</span>}
                    </div>
                    {batch.status === 'failed' && (
                       <div className="mt-2 bg-red-100/50 p-2 rounded border border-red-100">
                          <p className="font-bold text-red-800 uppercase mb-1">{batch.errorType || 'PROCESSING ERROR'}</p>
                          <p className="text-red-600 mb-2">{batch.errorMessage || 'Unknown error occurred during extraction.'}</p>
                          <button 
                            onClick={() => retryBatch(batch)}
                            className="inline-flex items-center px-2 py-1 bg-white border border-red-200 text-red-700 rounded hover:bg-red-50 transition-colors font-bold uppercase tracking-wider"
                          >
                             <RefreshCw className="w-3 h-3 mr-1" /> Retry Batch
                          </button>
                       </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
