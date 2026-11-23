// Único arquivo que conhece a URL/versão do Firebase.
// Os demais módulos importam tudo o que precisam daqui.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getDatabase, ref, onValue, update, set } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import {
  getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { CONFIG } from './config.js';

export const app = initializeApp(CONFIG.firebase);
export const db = getDatabase(app);
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(e => console.error('Erro auth:', e));

export {
  ref, onValue, update, set,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
};
