import { useEffect, useState, useRef } from 'react';
import { onSnapshot } from 'firebase/firestore';
import pwaOptimizer from '../utils/pwaOptimizations';

// Hook optimizado para queries de Firestore en PWA
export function useOptimizedFirestore(query, options = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);
  const isActiveRef = useRef(true);
  
  const {
    enableCache = true,
    cacheKey = null,
    cacheTimeout = 5 * 60 * 1000, // 5 minutos default
    realtime = true
  } = options;

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    // Cache check si está habilitado
    if (enableCache && cacheKey) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTimeout) {
            setData(cachedData);
            setLoading(false);
            console.log(`📦 Datos cargados desde cache: ${cacheKey}`);
            
            // Si no es tiempo real, usar solo cache
            if (!realtime) return;
          }
        } catch (e) {
          console.warn('Error parsing cache:', e);
        }
      }
    }

    const startListener = () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      console.log(`🔥 Iniciando listener Firebase: ${cacheKey || 'unnamed'}`);
      
      unsubscribeRef.current = onSnapshot(
        query,
        (snapshot) => {
          if (!isActiveRef.current) return;

          const docs = [];
          snapshot.forEach((doc) => {
            docs.push({ id: doc.id, ...doc.data() });
          });

          setData(docs);
          setLoading(false);
          setError(null);

          // Guardar en cache si está habilitado
          if (enableCache && cacheKey) {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: docs,
              timestamp: Date.now()
            }));
          }

          console.log(`✅ Datos actualizados: ${docs.length} documentos`);
        },
        (err) => {
          if (!isActiveRef.current) return;
          
          console.error('Firebase listener error:', err);
          setError(err);
          setLoading(false);

          // Reintentar después de delay en caso de error
          setTimeout(() => {
            if (isActiveRef.current) {
              startListener();
            }
          }, 5000);
        }
      );
    };

    // Usar el optimizador PWA para manejar visibilidad
    if (realtime) {
      const cleanup = pwaOptimizer.createOptimizedListener(query, (snapshot) => {
        if (!isActiveRef.current) return;

        const docs = [];
        snapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() });
        });

        setData(docs);
        setLoading(false);
        setError(null);

        // Guardar en cache
        if (enableCache && cacheKey) {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: docs,
            timestamp: Date.now()
          }));
        }
      });

      return cleanup;
    } else {
      // Para queries no tiempo real, usar listener normal
      startListener();
    }

    return () => {
      isActiveRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [query, cacheKey, enableCache, cacheTimeout, realtime]);

  // Cleanup al desmontaje
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return { data, loading, error };
}

// Hook para queries estáticas optimizadas (no tiempo real)
export function useOptimizedQuery(queryFn, dependencies = [], options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const {
    enableCache = true,
    cacheKey = null,
    cacheTimeout = 10 * 60 * 1000, // 10 minutos para queries estáticas
  } = options;

  useEffect(() => {
    const fetchData = async () => {
      // Check cache primero
      if (enableCache && cacheKey) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { data: cachedData, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < cacheTimeout) {
              setData(cachedData);
              setLoading(false);
              console.log(`📦 Query cargada desde cache: ${cacheKey}`);
              return;
            }
          } catch (e) {
            console.warn('Error parsing cache:', e);
          }
        }
      }

      try {
        console.log(`🔥 Ejecutando query: ${cacheKey || 'unnamed'}`);
        const result = await queryFn();
        setData(result);
        setError(null);

        // Guardar en cache
        if (enableCache && cacheKey) {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: result,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.error('Query error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, dependencies);

  return { data, loading, error };
}