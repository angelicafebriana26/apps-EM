import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  writeBatch, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  updateDoc,
  deleteDoc,
  orderBy,
  limit
} from 'firebase/firestore';

export interface DocumentMetadata {
  document_id: string;
  filename: string;
  file_hash?: string;
  page_count: number;
  room_count: number;
  measurement_count: number;
  imported_at: any;
  processing_status: string;
}

export interface EMMeasurementRecord {
  measurement_id: string;
  document_id: string;
  measurement_date: string | null;
  room_grade: string | null;
  room_name: string | null;
  parameter_code: string;
  parameter_name: string;
  result: number | null;
  unit: string | null;
  alert_limit: number | null;
  action_limit: number | null;
  acceptance_criteria: number | null;
  calculated_status: string | null;
  final_status: string | null;
  room_conclusion: string | null;
  source_page: number | null;
  extraction_method: string | null;
  sample_submission_date?: string | null;
  microorganism_id_status?: 'NOT ENTERED' | 'IDENTIFIED' | 'NOT IDENTIFIED' | string | null;
  microorganism_name?: string | null;
  microorganism_names?: string[] | null;
  created_at?: any;
  updated_at?: any;
}

export async function checkDuplicateDocument(filename: string, fileHash?: string): Promise<{ isDuplicate: boolean; existingDoc: DocumentMetadata | null }> {
  try {
    if (fileHash) {
      const qHash = query(collection(db, 'em_documents'), where('file_hash', '==', fileHash), limit(1));
      const snapHash = await getDocs(qHash);
      if (!snapHash.empty) {
        return { isDuplicate: true, existingDoc: snapHash.docs[0].data() as DocumentMetadata };
      }
    }
    const q = query(collection(db, 'em_documents'), where('filename', '==', filename), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { isDuplicate: true, existingDoc: querySnapshot.docs[0].data() as DocumentMetadata };
    }
    return { isDuplicate: false, existingDoc: null };
  } catch (err) {
    console.error('Error checking duplicate document:', err);
    return { isDuplicate: false, existingDoc: null };
  }
}

export async function importEMData(documentMetadata: DocumentMetadata, measurements: EMMeasurementRecord[]): Promise<void> {
  const batch = writeBatch(db);
  
  // Create document metadata
  const docRef = doc(db, 'em_documents', documentMetadata.document_id);
  batch.set(docRef, {
    ...documentMetadata,
    imported_at: serverTimestamp()
  });

  // Since a batch is limited to 500 operations, chunk the measurements if > 499
  const CHUNK_SIZE = 400;
  
  if (measurements.length > CHUNK_SIZE) {
    let currentBatch = writeBatch(db);
    currentBatch.set(docRef, { ...documentMetadata, imported_at: serverTimestamp() });
    
    let opCount = 1;
    
    for (const record of measurements) {
      const measurementRef = doc(db, 'em_measurements', record.measurement_id);
      currentBatch.set(measurementRef, {
        ...record,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      
      opCount++;
      
      if (opCount >= CHUNK_SIZE) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    }
    
    if (opCount > 0) {
      await currentBatch.commit();
    }
  } else {
    for (const record of measurements) {
      const measurementRef = doc(db, 'em_measurements', record.measurement_id);
      batch.set(measurementRef, {
        ...record,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
    }
    await batch.commit();
  }
}

export async function getEMMeasurements(): Promise<EMMeasurementRecord[]> {
  try {
    const q = query(collection(db, 'em_measurements'), limit(5000));
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(d => d.data() as EMMeasurementRecord);
    // Sort descending by measurement_date, fallback to created_at
    return records.sort((a, b) => {
      const dateA = a.measurement_date || '';
      const dateB = b.measurement_date || '';
      if (dateA && dateB) return dateB.localeCompare(dateA);
      if (dateA) return -1;
      if (dateB) return 1;
      return 0;
    });
  } catch (err) {
    console.error('Error fetching EM measurements:', err);
    return [];
  }
}

export async function updateMeasurement(id: string, updates: Partial<EMMeasurementRecord>): Promise<void> {
  const docRef = doc(db, 'em_measurements', id);
  await updateDoc(docRef, {
    ...updates,
    updated_at: serverTimestamp()
  });
}

export async function deleteMeasurement(id: string): Promise<void> {
  const docRef = doc(db, 'em_measurements', id);
  await deleteDoc(docRef);
}

// Function to delete an entire imported document and its measurements
export async function deleteDocumentAndMeasurements(documentId: string): Promise<void> {
  const q = query(collection(db, 'em_measurements'), where('document_id', '==', documentId));
  const snapshot = await getDocs(q);
  
  let currentBatch = writeBatch(db);
  let opCount = 0;
  
  for (const docSnap of snapshot.docs) {
    currentBatch.delete(docSnap.ref);
    opCount++;
    if (opCount >= 400) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }
  
  // Delete the document itself
  currentBatch.delete(doc(db, 'em_documents', documentId));
  await currentBatch.commit();
}
