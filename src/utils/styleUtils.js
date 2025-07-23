// Utilidades para estilos con compatibilidad Android/iOS

/**
 * Helper para backdrop-filter con fallback para Android
 * @param {string} blur - Valor del blur (ej: 'blur(10px)')
 * @returns {Object} Objeto con estilos compatibles
 */
export const getBackdropFilter = (blur = 'blur(10px)') => {
  // Detectar si es Android
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  if (isAndroid) {
    // En Android, usar background más opaco en lugar de backdrop-filter
    return {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      // Mantener backdrop-filter como fallback para navegadores que lo soporten
      backdropFilter: blur,
      WebkitBackdropFilter: blur,
    };
  }
  
  // En iOS y otros, usar backdrop-filter normal
  return {
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
  };
};

/**
 * Helper para estilos de Card con mejor compatibilidad Android
 * @param {Object} customStyles - Estilos personalizados adicionales
 * @returns {Object} Estilos optimizados para Android
 */
export const getCardStyles = (customStyles = {}) => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  const baseStyles = {
    borderRadius: 24,
    background: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
    boxShadow: isAndroid 
      ? '0 4px 12px rgba(0, 0, 0, 0.15)' // Sombra más fuerte en Android
      : '0 2px 8px rgba(0, 0, 0, 0.1)',
    // Mejoras para Android
    transform: 'translateZ(0)', // Forzar aceleración de hardware
    willChange: 'transform',
    ...getBackdropFilter('blur(10px)'),
    ...customStyles
  };
  
  return baseStyles;
};

/**
 * Helper para botones con mejor touch en Android
 * @param {Object} customStyles - Estilos personalizados
 * @returns {Object} Estilos optimizados para touch
 */
export const getButtonStyles = (customStyles = {}) => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  return {
    // Asegurar área de touch mínima en Android
    minHeight: isAndroid ? '48px' : '44px',
    minWidth: isAndroid ? '48px' : '44px',
    // Mejorar responsividad táctil
    cursor: 'pointer',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    // Acelerar animaciones
    transform: 'translateZ(0)',
    willChange: 'transform',
    ...customStyles
  };
};

/**
 * Helper para inputs con mejor compatibilidad Android
 * @param {Object} customStyles - Estilos personalizados
 * @returns {Object} Estilos optimizados para inputs
 */
export const getInputStyles = (customStyles = {}) => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  return {
    // Asegurar zoom correcto en Android
    fontSize: isAndroid ? '16px' : '0.95rem', // Evitar zoom automático en Android
    minHeight: isAndroid ? '48px' : '44px',
    // Mejorar touch
    touchAction: 'manipulation',
    userSelect: 'auto',
    WebkitUserSelect: 'auto',
    // Acelerar rendering
    transform: 'translateZ(0)',
    willChange: 'contents',
    ...customStyles
  };
};

/**
 * Detectar el tipo de dispositivo
 * @returns {Object} Información del dispositivo
 */
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  
  return {
    isAndroid: /Android/i.test(userAgent),
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    isChrome: /Chrome/i.test(userAgent),
    isSafari: /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent),
  };
};
