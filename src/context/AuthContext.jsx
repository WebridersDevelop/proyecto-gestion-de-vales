import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [rol, setRol] = useState(null);
  const [nombre, setNombre] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setRol(null);
      setNombre(null);
      if (firebaseUser) {
        const docRef = doc(db, "usuarios", firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setRol(userData.rol || "");
          setNombre(userData.nombre || "Usuario sin nombre");
        } else {
          setRol(""); // No tiene documento de rol
          setNombre("Usuario sin nombre");
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async ({ email, password }) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRol(null);
    navigate('/'); // Redirige al login
  };

  return (
    <AuthContext.Provider value={{ user, rol, nombre, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}