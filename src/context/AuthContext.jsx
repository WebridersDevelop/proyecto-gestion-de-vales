import { createContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

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
        // Verificar caché local primero
        const cacheKey = `user_data_${firebaseUser.uid}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        
        if (cachedData) {
          try {
            const { userData, timestamp } = JSON.parse(cachedData);
            const cacheAge = Date.now() - timestamp;
            // Usar caché si tiene menos de 5 minutos
            if (cacheAge < 5 * 60 * 1000) {
              setRol(userData.rol || "");
              setNombre(userData.nombre || "Usuario sin nombre");
              setLoading(false);
              return;
            }
          } catch (e) {
            // Si hay error en el caché, continuar con la consulta
          }
        }

        // Solo hacer query si no hay caché válido
        try {
          const docRef = doc(db, "usuarios", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setRol(userData.rol || "");
            setNombre(userData.nombre || "Usuario sin nombre");
            
            // Guardar en caché
            sessionStorage.setItem(cacheKey, JSON.stringify({
              userData,
              timestamp: Date.now()
            }));
          } else {
            setRol(""); 
            setNombre("Usuario sin nombre");
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setRol("");
          setNombre("Usuario sin nombre");
        }
      } else {
        // Limpiar caché cuando no hay usuario
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('user_data_')) {
            sessionStorage.removeItem(key);
          }
        });
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

