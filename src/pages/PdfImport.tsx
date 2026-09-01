import React, { useRef, useState } from "react";
import { UploadCloud, FileText, AlertCircle, CheckCircle, Loader2, RefreshCw, Download, AlertTriangle, ArrowRight } from "lucide-react";
import { DocumentExtractionResult, ExtractionBatch, ExtractedRecord, RoomGroup } from "../types";
import ExtractionReview from "../components/ExtractionReview";
import { useImportStore } from "../store/importStore";
import { checkDuplicateDocument, importEMData, DocumentMetadata, EMMeasurementRecord } from "../services/emDatabaseService";
import { Link, useNavigate } from "react-router-dom";
import { exportToExcel } from "../lib/exportUtils";

interface ImportSummary {
  filename: string;
  roomCount: number;
  measurementCount: number;
  confirmedRooms: RoomGroup[];
}

export function PdfImport() {
  const navigate = useNavigate();
  const { 
    fileBuffer, 
    fileName, 
    uploading, 
    result, 
    reviewMode, 
    setFileDetails, 
    setUploading, 
    setResult, 
    setReviewMode, 
    clearImport 
  } = useImportStore();
  
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null);
  const [importingToDb, setImportingToDb] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Duplicate Modal State
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    doc: DocumentMetadata | null;
    pendingFile: File | null;
    pendingBuffer: ArrayBuffer | null;
    pendingHash: string | null;
  }>({
    isOpen: false,
    doc: null,
    pendingFile: null,
    pendingBuffer: null,
    pendingHash: null
  });

  // Discard Unfinished Review Modal State
  const [discardModal, setDiscardModal] = useState<{
    isOpen: boolean;
    pendingFile: File | null;
  }>({
    isOpen: false,
    pendingFile: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateHash = async (buffer: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSelectedFile = async (file: File) => {
    if (!file) return;

    // Check if there is an unfinished review in progress
    const hasUnfinishedSession = reviewMode || (result && result.records.length > 0 && result.status === 'extracted');
    if (hasUnfinishedSession) {
      setDiscardModal({
        isOpen: true,
        pendingFile: file
      });
      return;
    }

    await processFileValidation(file);
  };

  const processFileValidation = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hash = await calculateHash(arrayBuffer);

      // Duplicate Check against Firestore
      const { isDuplicate, existingDoc } = await checkDuplicateDocument(file.name, hash);
      if (isDuplicate && existingDoc) {
        setDuplicateModal({
          isOpen: true,
          doc: existingDoc,
          pendingFile: file,
          pendingBuffer: arrayBuffer,
          pendingHash: hash
        });
        return;
      }

      // Proceed to extraction
      setFileDetails(file.name, arrayBuffer);
      setCurrentFileHash(hash);
      startProcess(file, hash);
    } catch (e) {
      console.error("Error validating file:", e);
      // Fallback: proceed directly to process
      const arrayBuffer = await file.arrayBuffer();
      setFileDetails(file.name, arrayBuffer);
      startProcess(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleSelectedFile(selectedFile);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      handleSelectedFile(file);
    }
  };

  const safeJsonParse = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON response:", text.substring(0, 100));
      if (text.trim().toLowerCase().startsWith('<!doctype html') || text.includes('<html')) {
        throw new Error("Session expired or request intercepted by proxy. Please refresh the page and try again.");
      }
      throw new Error("Invalid response format from server.");
    }
  };

  const startProcess = async (selectedFile: File, fileHash?: string) => {
    setUploading(true);
    setResult(null);
    setReviewMode(false);
    setImportSuccess(false);
    setLastImportSummary(null);

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

      const { extractPageLocally } = await import('../lib/extractor');

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        currentResult = {
          ...currentResult,
          batches: currentResult.batches.map(b => b.id === batch.id ? { ...b, status: 'processing' } : b)
        };
        setResult(currentResult);

        try {
          const localResult = await extractPageLocally(selectedFile, batch.startPage);
          
          let records = [];
          
          if (localResult.confidence === 'HIGH' && localResult.records.length > 0) {
            records = localResult.records;
          } else {
            // Fallback to Gemini Server Extraction
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
                records = [{
                  measurement_date: null,
                  room_name: `Page ${batch.startPage} (Unextracted)`,
                  room_grade: null,
                  parameter: '부유입자 ≥0.5 μm',
                  result: null,
                  unit: null,
                  alert_limit: null,
                  action_limit: null,
                  status: 'REVIEW REQUIRED',
                  source_page: batch.startPage,
                  extraction_method: 'GEMINI_FALLBACK'
                }];
              } else {
                throw new Error(JSON.stringify({
                   errorType: errorType,
                   errorMessage: (errData as any).error || `Batch ${batch.id} failed with status ${batchRes.status}`
                }));
              }
            } else {
              const json = await safeJsonParse(batchRes);
              records = (json.records || []).map((r: any) => ({
                ...r,
                extraction_method: 'GEMINI_FALLBACK'
              }));
            }
          }

          // Assign unique IDs to records
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
      
      // Auto-open review if extraction succeeded without failed batches
      if (!hasFailedBatch) {
        setReviewMode(true);
      }

    } catch (error: any) {
      console.error(error);
      setUploading(false);
      const errorMessage = error?.message === "Failed to fetch" 
         ? "Network error: Failed to reach the server. Please try again."
         : error?.message || "An unknown error occurred.";
         
      if (result) {
        setResult({ 
          ...result, 
          status: 'failed',
          error: errorMessage
        } as any);
      }
    }
  };

  const retryBatch = async (batchToRetry: ExtractionBatch) => {
    if (!result) return;
    
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
         recordsToAdd = (records || []).map((r: any) => ({
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
      // 1. Prepare metadata with hash & unique doc ID
      const totalMeasurements = rooms.reduce((acc, r) => acc + Object.keys(r.parameters).length, 0);

      const documentMetadata: DocumentMetadata = {
        document_id: result.uploadId,
        filename: fileName,
        file_hash: currentFileHash || undefined,
        page_count: result.totalPages,
        room_count: rooms.length,
        measurement_count: totalMeasurements,
        imported_at: null,
        processing_status: 'IMPORTED'
      };

      // 2. Prepare measurement records from confirmed rooms
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
            acceptance_criteria: null,
            calculated_status: param.status || null,
            final_status: param.manual_status || param.status || null,
            room_conclusion: room.conclusion || null,
            source_page: param.source_page || null,
            extraction_method: param.extraction_method || null
          });
        });
      });

      // 3. Save to Firestore (accumulative)
      await importEMData(documentMetadata, measurements);

      // 4. Update summary state
      setLastImportSummary({
        filename: fileName,
        roomCount: rooms.length,
        measurementCount: totalMeasurements,
        confirmedRooms: rooms
      });
      setImportSuccess(true);
      setReviewMode(false);
      
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportError(err.message || 'Failed to save data to the database.');
    } finally {
      setImportingToDb(false);
    }
  };

  const handleExportImportedBatch = () => {
    if (!lastImportSummary) return;
    const exportName = `EM_Extraction_${lastImportSummary.filename.replace('.pdf', '')}.xlsx`;
    exportToExcel(lastImportSummary.confirmedRooms, exportName);
  };

  const handleImportAnother = () => {
    setImportSuccess(false);
    setLastImportSummary(null);
    setCurrentFileHash(null);
    clearImport();
  };

  // 1. IMPORT COMPLETE SCREEN
  if (importSuccess && lastImportSummary) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 sm:p-12 max-w-xl mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
          <CheckCircle className="w-8 h-8" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">IMPORT COMPLETE</h2>
        <p className="text-sm text-gray-500 mb-6">
          Environmental Monitoring records have been successfully added to the database.
        </p>

        <div className="bg-gray-50/80 border border-gray-200 rounded-lg p-5 mb-8 text-left space-y-3 text-xs">
          <div className="flex justify-between items-center pb-2.5 border-b border-gray-200">
            <span className="text-gray-500 font-medium">File:</span>
            <span className="text-gray-900 font-semibold truncate max-w-[280px]" title={lastImportSummary.filename}>
              {lastImportSummary.filename}
            </span>
          </div>
          <div className="flex justify-between items-center pb-2.5 border-b border-gray-200">
            <span className="text-gray-500 font-medium">Rooms Imported:</span>
            <span className="text-gray-900 font-bold text-sm">{lastImportSummary.roomCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Measurements Imported:</span>
            <span className="text-gray-900 font-bold text-sm">{lastImportSummary.measurementCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link 
            to="/data"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-colors flex items-center justify-center gap-1.5"
          >
            View EM Data
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button 
            onClick={handleExportImportedBatch}
            className="px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 font-bold text-xs uppercase tracking-wider rounded border border-green-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button 
            onClick={handleImportAnother}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Import Another PDF
          </button>
        </div>
      </div>
    );
  }

  // 2. EXTRACTION REVIEW SCREEN
  if (reviewMode && result) {
    return (
      <div className="relative">
        {importingToDb && (
          <div className="absolute inset-0 bg-white/85 z-50 flex items-center justify-center rounded-xl backdrop-blur-xs">
            <div className="text-center p-6 bg-white border border-gray-200 rounded-xl shadow-lg">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="font-bold text-blue-900 uppercase tracking-widest text-xs">Saving Measurements to Firestore...</p>
            </div>
          </div>
        )}
        {importError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Import Failed</p>
              <p className="text-xs">{importError}</p>
              <button 
                onClick={() => setImportError(null)}
                className="mt-2 text-[10px] font-bold uppercase tracking-wider bg-white px-3 py-1 rounded border border-red-200 hover:bg-red-100"
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

  // 3. MAIN UPLOAD & QUEUE SCREEN
  return (
    <div className="space-y-8">
      {/* Unfinished Session Notification Banner */}
      {result && result.records.length > 0 && result.status === 'extracted' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-xs text-orange-900">Unfinished PDF Extraction in Progress</p>
              <p className="text-[11px] text-orange-700">{result.filename} ({result.recordsExtracted} records extracted)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReviewMode(true)}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] uppercase tracking-wider rounded transition-colors"
            >
              Continue Review
            </button>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to discard this extraction session?")) {
                  clearImport();
                }
              }}
              className="px-3 py-1.5 bg-white hover:bg-orange-100 text-orange-700 border border-orange-300 font-bold text-[10px] uppercase tracking-wider rounded transition-colors"
            >
              Discard Session
            </button>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div 
        className={`qc-card border-dashed px-6 py-16 text-center transition-colors cursor-pointer ${
          isDragOver ? 'border-orange-500 bg-orange-50/50' : 'border-gray-300 hover:bg-gray-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
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
          <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        )}
        <h3 className="text-base font-bold text-gray-800 mb-2">
          {uploading ? 'Processing PDF Document...' : 'Drag Environmental Monitoring CoA PDF files here'}
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          {uploading ? 'Extracting via local parser & Gemini AI in batches...' : 'Supports text and scanned PDFs.'}
        </p>
        <button 
          type="button" 
          disabled={uploading}
          className="btn-secondary disabled:opacity-50"
        >
          {uploading ? 'Extracting...' : 'Select PDF Files'}
        </button>
      </div>

      {/* File Processing Table */}
      <div className="qc-card overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <span className="w-2 h-4 bg-orange-500 rounded-full"></span>
            Processing Queue
          </h3>
          {result?.status === 'incomplete' && (
             <button 
                onClick={() => setReviewMode(true)}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
             >
               Review Required
             </button>
          )}
          {result?.status === 'extracted' && (
             <button 
                onClick={() => setReviewMode(true)}
                className="btn-primary"
             >
               Open Review
             </button>
          )}
        </div>
        <div className="p-6">
          <div className="border border-gray-200 rounded-xl overflow-hidden h-full bg-white">
            <table className="qc-table">
              <thead>
                <tr>
                  <th scope="col" className="qc-th">File Name</th>
                  <th scope="col" className="qc-th">Batches</th>
                  <th scope="col" className="qc-th">Progress</th>
                  <th scope="col" className="qc-th">Rooms Detected</th>
                  <th scope="col" className="qc-th">Records Extracted</th>
                  <th scope="col" className="qc-th text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {!result ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center">
                      <FileText className="mx-auto h-8 w-8 text-gray-300 mb-3" />
                      <p className="text-xs font-semibold text-gray-400">No files in queue</p>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td className="qc-td font-semibold text-gray-900">{result.filename}</td>
                    <td className="qc-td font-mono">
                      {result.batches.length} ({result.totalPages} pages)
                    </td>
                    <td className="qc-td">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 transition-all duration-300" 
                            style={{ width: `${(result.processedPages / result.totalPages) * 100}%` }}
                          />
                        </div>
                        <span className="text-gray-500 font-mono text-[11px]">{Math.round((result.processedPages / result.totalPages) * 100)}%</span>
                      </div>
                    </td>
                    <td className="qc-td font-mono">{result.roomsDetected || '-'}</td>
                    <td className="qc-td font-mono">{result.recordsExtracted}</td>
                    <td className="qc-td text-right">
                      {result.status === 'processing' && <span className="status-badge status-alert inline-flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</span>}
                      {result.status === 'extracted' && <span className="status-badge status-action inline-flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Extracted</span>}
                      {result.status === 'incomplete' && <span className="status-badge status-oos inline-flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Incomplete</span>}
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

      {/* 4. DUPLICATE DETECTION MODAL */}
      {duplicateModal.isOpen && duplicateModal.doc && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-base text-gray-900">Duplicate PDF Detected</h3>
            </div>
            
            <p className="text-xs text-gray-600 mb-4">
              This PDF appears to have already been imported into the database:
            </p>

            <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-4 mb-6 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">File Name:</span>
                <span className="text-gray-900 font-semibold truncate max-w-[200px]" title={duplicateModal.doc.filename}>
                  {duplicateModal.doc.filename}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Rooms Imported:</span>
                <span className="text-gray-900 font-bold">{duplicateModal.doc.room_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Measurements:</span>
                <span className="text-gray-900 font-bold">{duplicateModal.doc.measurement_count}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => setDuplicateModal({ isOpen: false, doc: null, pendingFile: null, pendingBuffer: null, pendingHash: null })}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDuplicateModal({ isOpen: false, doc: null, pendingFile: null, pendingBuffer: null, pendingHash: null });
                  navigate('/data');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-colors"
              >
                View Existing Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. DISCARD UNFINISHED SESSION MODAL */}
      {discardModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-orange-600 mb-4">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-base text-gray-900">Unfinished Extraction Session</h3>
            </div>
            
            <p className="text-xs text-gray-600 mb-6">
              You currently have an unconfirmed PDF extraction in progress (<span className="font-semibold text-gray-900">{fileName || result?.filename}</span>). 
              Starting a new import will clear your unconfirmed corrections.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => setDiscardModal({ isOpen: false, pendingFile: null })}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded transition-colors"
              >
                Continue Review
              </button>
              <button
                onClick={async () => {
                  const file = discardModal.pendingFile;
                  setDiscardModal({ isOpen: false, pendingFile: null });
                  clearImport();
                  if (file) {
                    await processFileValidation(file);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-colors"
              >
                Discard & Import New PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
