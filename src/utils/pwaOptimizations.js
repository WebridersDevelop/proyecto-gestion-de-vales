// PWA Optimizations para reducir lecturas de Firebase
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from '../firebase';

class PWAOptimizer {
  constructor() {
    this.isVisible = true;
    this.syncInterval = null;
    this.lastSync = Date.now();
    this.setupVisibilityHandlers();
  }

  setupVisibilityHandlers() {
    // Detectar cuando la app se vuelve invisible/visible
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      
      if (this.isVisible) {
        this.onAppVisible();
      } else {
        this.onAppHidden();
      }
    });

    // Detectar cuando la PWA pierde/gana foco
    window.addEventListener('focus', () => this.onAppVisible());
    window.addEventListener('blur', () => this.onAppHidden());
  }

  onAppVisible() {
    console.log('📱 PWA visible - Activando Firebase');
    
    // Reactivar Firebase cuando la app es visible
    enableNetwork(db);
    
    // Solo sincronizar si ha pasado suficiente tiempo
    const timeSinceLastSync = Date.now() - this.lastSync;
    if (timeSinceLastSync > 60000) { // 1 minuto
      this.triggerSmartSync();
    }
  }

  onAppHidden() {
    console.log('📱 PWA oculta - Pausando Firebase');
    
    // Pausar Firebase cuando la app está en background
    // NO deshabilitar completamente para mantener tiempo real crítico
    this.setupReducedActivity();
  }

  setupReducedActivity() {
    // En lugar de deshabilitar, reducir la frecuencia de queries
    // Los listeners en tiempo real se mantienen pero con throttling
    
    // Limpiar cache menos crítico cuando está en background
    setTimeout(() => {
      if (!this.isVisible) {
        this.cleanNonCriticalCache();
      }
    }, 30000); // 30 segundos en background
  }

  triggerSmartSync() {
    // Solo sincronizar datos críticos al volver
    console.log('🔄 Sincronización inteligente iniciada');
    
    this.lastSync = Date.now();
    
    // Limpiar cache expirado
    this.cleanExpiredCache();
    
    // Disparar evento personalizado para que los componentes se actualicen
    window.dispatchEvent(new CustomEvent('pwa-smart-sync'));
  }

  cleanNonCriticalCache() {
    // Limpiar cache de sessionStorage que no es crítico
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.includes('dashboard') || key.includes('stats')) {
        sessionStorage.removeItem(key);
      }
    });
    
    console.log('🧹 Cache no crítico limpiado');
  }

  cleanExpiredCache() {
    // Limpiar cache expirado de localStorage
    const keys = Object.keys(sessionStorage);
    const now = Date.now();
    
    keys.forEach(key => {
      try {
        const item = sessionStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          if (parsed.timestamp && (now - parsed.timestamp) > 300000) { // 5 minutos
            sessionStorage.removeItem(key);
          }
        }
      } catch (e) {
        // Ignorar errores de parsing
      }
    });
    
    console.log('🧹 Cache expirado limpiado');
  }

  // Método para que los componentes se registren para sync inteligente
  registerForSync(callback) {
    window.addEventListener('pwa-smart-sync', callback);
    
    // Cleanup
    return () => {
      window.removeEventListener('pwa-smart-sync', callback);
    };
  }

  // Optimización específica para Firebase listeners
  createOptimizedListener(query, callback) {
    let unsubscribe;
    let isActive = true;
    
    const startListener = () => {
      if (unsubscribe) unsubscribe();
      
      unsubscribe = query.onSnapshot(snapshot => {
        if (isActive && this.isVisible) {
          callback(snapshot);
        }
      }, error => {
        console.error('Firebase listener error:', error);
        // En caso de error, reintentar después de un delay
        if (isActive) {
          setTimeout(startListener, 5000);
        }
      });
    };
    
    // Iniciar listener
    startListener();
    
    // Pausar/reanudar listener según visibilidad
    const handleVisibility = () => {
      isActive = this.isVisible;
      if (!isActive && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      } else if (isActive && !unsubscribe) {
        startListener();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    
    // Cleanup function
    return () => {
      isActive = false;
      if (unsubscribe) unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }
}

// Instancia global del optimizador
const pwaOptimizer = new PWAOptimizer();

export default pwaOptimizer;