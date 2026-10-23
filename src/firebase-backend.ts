// Firebase Realtime Database för minispelets topplista. Den här modulen laddas
// med import() från leaderboard.ts först när topplistan behövs, så Firebase
// hamnar i en egen chunk och påverkar inte sidladdningen.
// Konfigurationen är publik by design: skyddet ligger i databasreglerna
// (database.rules.json, genereras med `npm run rules`).
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, get, set, serverTimestamp } from "firebase/database";
import type { Backend, Score } from "./leaderboard";

export const firebaseConfig = {
  apiKey: "AIzaSyDd742I3zkYkrYA99pjUGtCVB_qAdG_auk",
  authDomain: "vilgots-kalas.firebaseapp.com",
  databaseURL: "https://vilgots-kalas-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "vilgots-kalas",
  storageBucket: "vilgots-kalas.firebasestorage.app",
  messagingSenderId: "457960162011",
  appId: "1:457960162011:web:365b6a8adba90caf2102fe",
};

export function createBackend(): Backend {
  const db = getDatabase(initializeApp(firebaseConfig));
  return {
    listen(onData, onError) {
      onValue(ref(db, "scores"), (snap) => onData(snap.val()), onError);
    },
    // Läser först och skriver bara om poängen är högre. Reglerna kräver detsamma,
    // så en kapplöpning mellan två enheter ger en nekad skrivning, inte en sänkning.
    async post(key, entry) {
      const r = ref(db, `scores/${key}`);
      const cur = (await get(r)).val() as Score | null;
      if (cur && cur.score >= entry.score) return false;
      await set(r, { name: entry.name, score: entry.score, updatedAt: serverTimestamp() });
      return true;
    },
  };
}
