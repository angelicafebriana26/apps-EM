import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import { ExtractedRecord } from '../types';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface LocalExtractionResult {
  confidence: 'HIGH' | 'LOW';
  records: ExtractedRecord[];
  method: 'NATIVE_TEXT' | 'LOCAL_OCR';
}

export async function extractPageLocally(file: File, pageNumber: number): Promise<LocalExtractionResult> {
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
  
  await page.render({ canvasContext: context, viewport }).promise;
  
  const imageDataUrl = canvas.toDataURL('image/png');
  
  const ocrResult = await Tesseract.recognize(
    imageDataUrl,
    'kor+eng',
    { logger: m => console.log(m) }
  );
  
  const ocrText = ocrResult.data.text;
  return parseTextToRecords(ocrText, pageNumber, 'LOCAL_OCR');
}

function parseTextToRecords(text: string, pageNumber: number, method: 'NATIVE_TEXT' | 'LOCAL_OCR'): LocalExtractionResult {
  const records: ExtractedRecord[] = [];
  let confidence: 'HIGH' | 'LOW' = 'LOW';
  
  // Basic heuristic: check if we see key headers
  const hasEmKeywords = text.includes("부유입자") || text.includes("표면균") || text.includes("낙하균") || text.includes("부유균");
  
  if (!hasEmKeywords) {
    return { confidence: 'LOW', records, method };
  }

  // Very basic deterministic parsing attempt
  // In reality, this would use regex to match rows like: "Room A Grade A 0.5 5.0 ..."
  // For this exercise, we will set a strict heuristic. If we can't clearly parse rows with room names and grades,
  // we fallback to Gemini.
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // For a real production app, we would write complex regex here.
  // We'll simulate a deterministic parser that only succeeds if it finds a very specific format.
  let currentRoom = null;
  let currentGrade = null;
  let currentDate = null;
  
  const dateRegex = /\d{4}[-/]\d{2}[-/]\d{2}/;
  
  for (const line of lines) {
    if (dateRegex.test(line)) {
      currentDate = line.match(dateRegex)?.[0] || currentDate;
    }
    // Just a placeholder heuristic - in reality we need a robust parser
    // If we can't confidently parse, we will remain 'LOW'
  }
  
  // If we couldn't parse anything confidently, return LOW
  if (records.length === 0) {
    confidence = 'LOW';
  } else {
    confidence = 'HIGH';
  }

  return { confidence, records, method };
}
