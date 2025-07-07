import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCiQVRoRF5tKIVtC3vzPPUVO2ALyecytE8",
  authDomain: "proyecto-vales.firebaseapp.com",
  projectId: "proyecto-vales",
  storageBucket: "proyecto-vales.appspot.com",
  messagingSenderId: "1016151478605",
  appId: "1:1016151478605:web:9c90aea85c314ca3fd6704",
  measurementId: "G-HQCEB2HY41"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;