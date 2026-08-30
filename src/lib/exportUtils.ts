import * as XLSX from 'xlsx-js-style';
import { RoomGroup, ExtractedRecord } from '../types';
import { emCriteriaMaster } from './emCriteriaConfig';

function getStatusColorHex(status: string | null | undefined): string {
  switch (status) {
    case 'PASS': return '000000'; // Black
    case 'ALERT': return '2563EB'; // Blue
    case 'ACTION': return '16A34A'; // Green
    case 'OOS': return 'DC2626'; // Red
    default: return '000000'; // Black fallback
  }
}

export function exportToExcel(rooms: RoomGroup[], filename: string) {
  // 1. EM Data Sheet
  const emDataRows: any[] = [];
  
  rooms.forEach((room) => {
    const row: any = {
      'Room Cleanliness Grade': room.manual_grade || room.room_grade || '',
      'Room Name': room.room_name || '',
    };

    const parameters = ['부유입자 ≥0.5 μm', '부유입자 ≥5.0 μm', '부유균', '낙하균', '표면균'];
    parameters.forEach(param => {
      const record = room.parameters[param];
      if (record) {
        const finalStatus = record.manual_status || record.status;
        row[`${param} Result`] = record.result !== null ? record.result : '';
        row[`${param} Status`] = finalStatus || '';
      } else {
        row[`${param} Result`] = '';
        row[`${param} Status`] = '';
      }
    });

    row['Date of Measurement'] = room.measurement_date || '';
    row['Conclusion'] = room.manual_conclusion || room.conclusion || '';
    
    // Pick the first source page found as the source document ref
    const firstParam = Object.values(room.parameters)[0];
    row['Source Page'] = firstParam?.source_page ? `Page ${firstParam.source_page}` : '';

    emDataRows.push(row);
  });

  const emDataSheet = XLSX.utils.json_to_sheet(emDataRows);

  // Apply colors to the result cells based on their status
  // In sheetjs, cells are accessed like A1, B2.
  const range = XLSX.utils.decode_range(emDataSheet['!ref'] || 'A1');
  const headers: string[] = [];
  
  // Read headers
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = emDataSheet[XLSX.utils.encode_cell({ r: 0, c: C })];
    headers[C] = cell ? cell.v : '';
  }

  // Iterate rows and apply styles
  for (let R = 1; R <= range.e.r; ++R) {
    for (let C = 0; C <= range.e.c; ++C) {
      const header = headers[C];
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = emDataSheet[cellRef];
      if (!cell) continue;

      if (header.endsWith('Result')) {
        const paramBase = header.replace(' Result', '');
        const statusColIdx = headers.indexOf(`${paramBase} Status`);
        if (statusColIdx !== -1) {
          const statusCell = emDataSheet[XLSX.utils.encode_cell({ r: R, c: statusColIdx })];
          const statusVal = statusCell ? statusCell.v : null;
          const color = getStatusColorHex(statusVal);
          cell.s = { font: { color: { rgb: color } } };
        }
      }
      
      if (header === 'Conclusion') {
        const color = getStatusColorHex(cell.v);
        cell.s = { font: { color: { rgb: color }, bold: true } };
      }
    }
  }

  // 2. Extraction Details Sheet
  const detailsData: any[] = [];
  rooms.forEach(room => {
    Object.values(room.parameters).forEach(record => {
      detailsData.push({
        'Measurement Date': room.measurement_date || '',
        'Grade': room.manual_grade || room.room_grade || '',
        'Room': room.room_name || '',
        'Parameter': record.parameter || '',
        'Result': record.result !== null ? record.result : '',
        'Unit': record.unit || '',
        'Calculated Status': record.status || '',
        'Final Status': record.manual_status || record.status || '',
        'Source Page': record.source_page || ''
      });
    });
  });

  const detailsSheet = XLSX.utils.json_to_sheet(detailsData);

  // 3. Criteria Sheet
  const criteriaData: any[] = [];
  Object.keys(emCriteriaMaster).forEach(grade => {
    Object.keys(emCriteriaMaster[grade]).forEach(param => {
      const limits = emCriteriaMaster[grade][param];
      criteriaData.push({
        'Grade': grade,
        'Parameter': param,
        'Alert Level': limits.alert !== null ? limits.alert : 'N/A',
        'Action Level': limits.action !== null ? limits.action : 'N/A',
        'Acceptance Criteria': limits.acceptance !== null ? limits.acceptance : 'N/A'
      });
    });
  });

  const criteriaSheet = XLSX.utils.json_to_sheet(criteriaData);

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, emDataSheet, 'EM Data');
  XLSX.utils.book_append_sheet(wb, detailsSheet, 'Extraction Details');
  XLSX.utils.book_append_sheet(wb, criteriaSheet, 'Criteria');

  // Save
  XLSX.writeFile(wb, filename);
}
