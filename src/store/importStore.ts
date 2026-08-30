import { create } from 'zustand';
import { DocumentExtractionResult, ExtractedRecord } from '../types';

interface ImportState {
  fileName: string | null;
  fileBuffer: ArrayBuffer | null;
  uploading: boolean;
  result: DocumentExtractionResult | null;
  reviewMode: boolean;
  
  setFileDetails: (name: string, buffer: ArrayBuffer) => void;
  setUploading: (uploading: boolean) => void;
  setResult: (result: DocumentExtractionResult | null) => void;
  setReviewMode: (reviewMode: boolean) => void;
  updateRecord: (updatedRecord: ExtractedRecord) => void;
  clearImport: () => void;
}

export const useImportStore = create<ImportState>((set) => ({
  fileName: null,
  fileBuffer: null,
  uploading: false,
  result: null,
  reviewMode: false,
  
  setFileDetails: (name, buffer) => set({ fileName: name, fileBuffer: buffer }),
  setUploading: (uploading) => set({ uploading }),
  setResult: (result) => set({ result }),
  setReviewMode: (reviewMode) => set({ reviewMode }),
  updateRecord: (updatedRecord) => set((state) => {
    if (!state.result) return state;
    const newRecords = state.result.records.map(r => 
      r.id === updatedRecord.id ? updatedRecord : r
    );
    return {
      result: {
        ...state.result,
        records: newRecords
      }
    };
  }),
  clearImport: () => set({ 
    fileName: null, 
    fileBuffer: null, 
    uploading: false, 
    result: null, 
    reviewMode: false 
  })
}));
