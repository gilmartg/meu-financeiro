import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { CONFIG } from './config.js';

export const app = initializeApp(CONFIG.firebase);
export const db = getDatabase(app);
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(e => console.error('Erro auth:', e));