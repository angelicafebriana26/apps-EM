import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import { ExtractedRecord } from '../types';

// Safely configure pdf.js worker URL from CDN without failing module bundle
try {
  if (typeof window !== 'undefined' && pdfjsLib) {
    // @ts-ignore
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.0.379'}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn("Could not set pdfjs workerSrc:", e);
}

export interface LocalExtractionResult {
  confidence: 'HIGH' | 'LOW';
  records: ExtractedRecord[];
  method: 'NATIVE_TEXT' | 'LOCAL_OCR';
}

export async function extractPageLocally(file: File, pageNumber: number): Promise<LocalExtractionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNumber);
    
    // 1. Try Native Text Extraction
    const textContent = await page.getTextContent();
    const textItems = textContent.items.map((item: any) => item.str).join(' ');
    
    // If we have enough text, try to parse it
    if (textItems.length > 200) {
      const parsed = parseTextToRecords(textItems, pageNumber, 'NATIVE_TEXT');
      if (parsed.confidence === 'HIGH') {
        return parsed;
      }
    }

    // 2. Fallback to Local OCR
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error("Could not create canvas context");
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await (page.render as any)({ canvasContext: context, viewport, canvas }).promise;
    
    const imageDataUrl = canvas.toDataURL('image/png');
    
    const ocrResult = await Tesseract.recognize(
      imageDataUrl,
      'kor+eng',
      { logger: m => console.log(m) }
    );
    
    const ocrText = ocrResult.data.text;
    return parseTextToRecords(ocrText, pageNumber, 'LOCAL_OCR');
  } catch (error) {
    console.warn(`Local extraction failed for page ${pageNumber}, will fallback:`, error);
    return {
      confidence: 'LOW',
      records: [],
      method: 'NATIVE_TEXT'
    };
  }
}

function parseTextToRecords(text: string, pageNumber: number, method: 'NATIVE_TEXT' | 'LOCAL_OCR'): LocalExtractionResult {
  const records: ExtractedRecord[] = [];
  let confidence: 'HIGH' | 'LOW' = 'LOW';
  
  // Basic heuristic: check if we see key headers
  const hasEmKeywords = text.includes("부유입자") || text.includes("표면균") || text.includes("낙하균") || text.includes("부유균");
  
  if (!hasEmKeywords) {
    return { confidence: 'LOW', records, method };
  }

  // If we couldn't parse structured records with certainty, fallback to Gemini
  if (records.length === 0) {
    confidence = 'LOW';
  } else {
    confidence = 'HIGH';
  }

  return { confidence, records, method };
}
