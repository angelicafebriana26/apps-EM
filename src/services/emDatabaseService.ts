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
  created_at?: any;
  updated_at?: any;
}

export async function checkDuplicateDocument(filename: string): Promise<{ isDuplicate: boolean; existingDoc: DocumentMetadata | null }> {
  const q = query(collection(db, 'em_documents'), where('filename', '==', filename), limit(1));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return { isDuplicate: true, existingDoc: querySnapshot.docs[0].data() as DocumentMetadata };
  }
  return { isDuplicate: false, existingDoc: null };
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
  // Each measurement is 1 op. So chunk size = 400.
  const CHUNK_SIZE = 400;
  
  if (measurements.length > CHUNK_SIZE) {
    let currentBatch = writeBatch(db);
    currentBatch.set(docRef, { ...documentMetadata, imported_at: serverTimestamp() });
    
    let opCount = 1; // doc set is 1
    
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
  const q = query(collection(db, 'em_measurements'), orderBy('measurement_date', 'desc'), limit(1000));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as EMMeasurementRecord);
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
