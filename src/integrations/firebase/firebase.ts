// Firebase client SDK initialization for DocBrain AI
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD9q3Nq5GwKkGHsmTtFQDBLH-1_hOn-VuM",
  authDomain: "docbrain-ai-9280e.firebaseapp.com",
  projectId: "docbrain-ai-9280e",
  storageBucket: "docbrain-ai-9280e.firebasestorage.app",
  messagingSenderId: "932960598951",
  appId: "1:932960598951:web:6e963bed5899d27483d482",
  measurementId: "G-VC7Z7KB62D",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
