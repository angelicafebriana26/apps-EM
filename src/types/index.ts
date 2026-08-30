export type Parameter = 
  | '부유입자 ≥0.5 μm' 
  | '부유입자 ≥5.0 μm' 
  | '부유균' 
  | '낙하균' 
  | '표면균';

export type Status = 'Pass' | 'Alert' | 'Action' | 'OOS' | 'PASS' | 'ALERT' | 'ACTION' | 'REVIEW REQUIRED' | 'NOT APPLICABLE';

export interface ExtractedRecord {
  id: string;
  measurement_date: string | null;
  room_name: string | null;
  room_grade: string | null;
  parameter: string | null;
  result: number | null;
  unit: string | null;
  alert_limit: number | null;
  action_limit: number | null;
  status: string | null;
  source_page: number | null;
  manual_status?: string | null;
  extraction_method?: 'NATIVE_TEXT' | 'LOCAL_OCR' | 'GEMINI_FALLBACK';
}

export interface RoomGroup {
  id: string;
  measurement_date: string | null;
  room_name: string | null;
  room_grade: string | null;
  manual_grade?: string | null;
  parameters: Record<string, ExtractedRecord>;
  source_page: number | null;
  conclusion: string | null;
  manual_conclusion?: string | null;
  document_id?: string;
}

export interface ExtractionBatch {
  id: string;
  startPage: number;
  endPage: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  recordsExtracted: number;
  error?: string;
  errorType?: string;
  errorMessage?: string;
}

export interface DocumentExtractionResult {
  uploadId: string;
  filename: string;
  totalPages: number;
  processedPages: number;
  roomsDetected: number;
  recordsExtracted: number;
  status: 'uploading' | 'processing' | 'extracted' | 'failed' | 'incomplete';
  batches: ExtractionBatch[];
  records: ExtractedRecord[];
  warnings: string[];
}
