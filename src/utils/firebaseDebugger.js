// Debug silencioso para Firebase - intercepta y cuenta todas las operaciones
// NO modifica funcionalidad, solo logs en background

class FirebaseDebugger {
  constructor() {
    this.sessionStats = {
      totalReads: 0,
      totalWrites: 0,
      componentCalls: {},
      startTime: Date.now(),
      operations: []
    };
    
    // Monkey patch console.log original de Firebase queries
    this.patchConsole();
    
    // Interceptar métodos específicos después de que se carguen
    setTimeout(() => this.setupInterceptors(), 1000);
    
    console.log('🔥 Firebase Debugger iniciado');
  }

  patchConsole() {
    const originalLog = console.log;
    console.log = (...args) => {
      // Detectar logs de Firebase
      const logStr = args.join(' ');
      if (logStr.includes('Firebase') || logStr.includes('firestore')) {
        this.sessionStats.operations.push({
          timestamp: Date.now(),
          type: 'firebase_log',
          message: logStr
        });
      }
      originalLog.apply(console, args);
    };
  }

  setupInterceptors() {
    // Interceptar específicamente nuestros componentes
    this.interceptComponent('CuadreDiario');
    this.interceptComponent('AprobarVales');
    this.interceptComponent('ValesServicio');
    this.interceptComponent('ValesGasto');
  }

  interceptComponent(componentName) {
    // Buscar en el DOM elementos relacionados con el componente
    const observer = new MutationObserver(() => {
      this.trackComponentActivity(componentName);
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }

  trackComponentActivity(componentName) {
    // Detectar actividad del componente basada en DOM
    if (window.location.pathname.includes(componentName.toLowerCase()) ||
        document.querySelector(`[data-component="${componentName}"]`)) {
      
      this.logComponentActivity(componentName);
    }
  }

  logComponentActivity(componentName) {
    if (!this.sessionStats.componentCalls[componentName]) {
      this.sessionStats.componentCalls[componentName] = 0;
    }
    this.sessionStats.componentCalls[componentName]++;
    
    console.log(`📱 [DEBUG] ${componentName} activo`, {
      calls: this.sessionStats.componentCalls[componentName],
      timestamp: new Date().toLocaleTimeString()
    });
  }

  // Método simple para contar operaciones manualmente
  countRead(component, docCount = 1) {
    this.sessionStats.totalReads += docCount;
    console.log(`📖 [DEBUG] Read: ${component} (+${docCount}) Total: ${this.sessionStats.totalReads}`);
  }

  countWrite(component) {
    this.sessionStats.totalWrites++;
    console.log(`✍️ [DEBUG] Write: ${component} Total: ${this.sessionStats.totalWrites}`);
  }

  generateReport() {
    const duration = Math.round((Date.now() - this.sessionStats.startTime) / 1000);
    
    console.group('🔥 FIREBASE DEBUG REPORT');
    console.log(`⏱️ Session: ${duration}s`);
    console.log(`📖 Total Reads: ${this.sessionStats.totalReads}`);
    console.log(`✍️ Total Writes: ${this.sessionStats.totalWrites}`);
    console.log(`📱 Component Activity:`, this.sessionStats.componentCalls);
    console.log(`📝 Recent Operations:`, this.sessionStats.operations.slice(-10));
    console.groupEnd();
    
    return this.sessionStats;
  }

  // Auto-reporte cada 2 minutos para detectar patrones
  startAutoReporting() {
    setInterval(() => {
      if (this.sessionStats.totalReads > 0 || this.sessionStats.totalWrites > 0) {
        this.generateReport();
      }
    }, 2 * 60 * 1000);
  }
}

// Instancia global
const firebaseDebugger = new FirebaseDebugger();
firebaseDebugger.startAutoReporting();

// Comandos globales para debug manual
window.fbDebug = firebaseDebugger;
window.fbReport = () => firebaseDebugger.generateReport();
window.fbCountRead = (component, docs) => firebaseDebugger.countRead(component, docs);
window.fbCountWrite = (component) => firebaseDebugger.countWrite(component);

console.log('🔍 Firebase Debugger listo');
console.log('💡 Comandos: window.fbReport(), window.fbCountRead("Component", 5)');

export default firebaseDebugger;