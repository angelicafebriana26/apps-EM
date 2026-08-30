import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "savvy-inverter-rjf39",
  appId: "1:54881194578:web:bd5bffcbc6a0dba542458b",
  apiKey: "AIzaSyCqFD8y3aeCnqnPGDC5CY4wmVVh7-RRyF8",
  authDomain: "savvy-inverter-rjf39.firebaseapp.com",
  storageBucket: "savvy-inverter-rjf39.firebasestorage.app",
  messagingSenderId: "54881194578"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-daewoongbioqcenv-f28d1737-0496-41f6-a952-2bed8f6d4f1d");

export { app, db };
