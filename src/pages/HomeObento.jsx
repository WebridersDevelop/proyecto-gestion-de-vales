import { useAuth } from '../hooks/useAuth';
import { useNavigate, NavLink } from 'react-router-dom';
import { Row, Col, Card, Badge } from 'react-bootstrap';
import { useState, useEffect } from 'react';
import { getDeviceInfo } from '../utils/styleUtils';

const deviceInfo = getDeviceInfo();

const buttonStyles = {
  base: {
    minWidth: deviceInfo.isAndroid ? 150 : 140,
    minHeight: deviceInfo.isAndroid ? 150 : 140,
    fontSize: deviceInfo.isAndroid ? 17 : 16,
    borderRadius: 20,
    boxShadow: deviceInfo.isAndroid 
      ? '0 6px 20px rgba(0,0,0,0.12)' 
      : '0 4px 16px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    margin: 8,
    cursor: 'pointer',
    fontWeight: 600,
    outline: 'none',
    position: 'relative',
    overflow: 'hidden',
    gap: 8,
    // Mejorar compatibilidad con Android
    transform: 'translateZ(0)',
    willChange: 'transform',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    // Backdrop filter con fallback para Android
    ...(deviceInfo.isAndroid 
      ? { backgroundColor: 'rgba(255, 255, 255, 0.95)' }
      : { backdropFilter: 'blur(10px)' }
    ),
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  dashboard: { 
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: '#ffffff'
  },
  vales: { 
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#ffffff'
  },
  gastos: { 
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: '#ffffff'
  },
  crear: { 
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff'
  },
  aprobar: { 
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    color: '#ffffff'
  },
  cuadre: { 
    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    color: '#ffffff'
  },
  salir: { 
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: '#ffffff'
  }
};

function HomeObento() {
  const { rol, logout, user } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar la hora cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Define los roles que pueden ver vales y gastos
  const rolesValesYGastos = ['admin', 'anfitrion', 'barbero', 'estilista', 'estetica'];

  // Función para obtener el saludo según la hora
  const getSaludo = () => {
    const hora = currentTime.getHours();
    if (hora < 12) return '🌅 Buenos días';
    if (hora < 18) return '☀️ Buenas tardes';
    return '🌙 Buenas noches';
  };

  const botones = [
    ...(rol === 'admin' ? [{
      icon: 'bi-speedometer2',
      label: 'Dashboard',
      to: '/dashboard',
      style: buttonStyles.dashboard,
      description: 'Análisis y métricas'
    }] : []),
    ...(rolesValesYGastos.includes(rol) ? [{
      icon: 'bi-receipt-cutoff',
      label: 'Vales de Servicio',
      to: '/vales-servicio',
      style: buttonStyles.vales,
      description: 'Registrar servicios'
    }] : []),
    ...(rolesValesYGastos.includes(rol) ? [{
      icon: 'bi-cash-coin',
      label: 'Gastos',
      to: '/vales-gasto',
      style: buttonStyles.gastos,
      description: 'Gestionar gastos'
    }] : []),
    ...(rol === 'admin' ? [{
      icon: 'bi-person-plus-fill',
      label: 'Crear Usuario',
      to: '/crear-usuario',
      style: buttonStyles.crear,
      description: 'Nuevos usuarios'
    }] : []),
    ...(rol === 'admin' || rol === 'anfitrion' ? [{
      icon: 'bi-shield-check',
      label: 'Aprobar Vales',
      to: '/aprobar-vales-servicio',
      style: buttonStyles.aprobar,
      description: 'Revisar y aprobar'
    }] : []),
    ...(rol === 'admin' || rol === 'anfitrion' ? [{
      icon: 'bi-table',
      label: 'Cuadre Diario',
      to: '/cuadre-diario',
      style: buttonStyles.cuadre,
      description: 'Balance del día'
    }] : []),
    {
      icon: 'bi-power',
      label: 'Cerrar Sesión',
      action: logout,
      style: buttonStyles.salir,
      description: 'Salir del sistema'
    }
  ];

  return (
    <>
      <Row className="justify-content-center mt-4">
        <Col xs={12} md={10} lg={8}>
          {/* Header con saludo personalizado */}
          <Card className="shadow-sm border-0 mb-4" style={{
            borderRadius: 24, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <Card.Body className="text-center py-4">
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                {getSaludo()}
              </div>
              <div style={{ fontSize: 18, fontWeight: 500, opacity: 0.9 }}>
                {user?.email && `${user.email.split('@')[0]}`}
              </div>
              <Badge bg="light" text="dark" className="mt-2" style={{ 
                fontSize: 14, 
                fontWeight: 600,
                textTransform: 'capitalize'
              }}>
                {rol}
              </Badge>
              <div style={{ fontSize: 14, marginTop: 8, opacity: 0.8 }}>
                {currentTime.toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </Card.Body>
          </Card>

          {/* Botones principales */}
          <Card className="shadow-sm border-0" style={{
            borderRadius: 24, 
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <Card.Body className="p-4">
              <Card.Title className="mb-4 text-center" style={{
                fontWeight: 700, 
                letterSpacing: '-0.5px', 
                fontSize: 24, 
                color: '#1e293b'
              }}>
                <i className="bi bi-grid-3x3-gap me-2" style={{ color: '#6366f1' }}></i>
                Panel de Control
              </Card.Title>
              
              <div className="d-flex flex-wrap justify-content-center gap-2" style={{ marginBottom: 10 }}>
                {botones.map((btn) => (
                  <div key={btn.label} className="position-relative">
                    <button
                      type="button"
                      style={{
                        ...buttonStyles.base,
                        ...btn.style
                      }}
                      onClick={() => btn.to ? navigate(btn.to) : btn.action()}
                      onMouseOver={e => {
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = buttonStyles.base.boxShadow;
                      }}
                    >
                      <i className={`bi ${btn.icon}`} style={{
                        fontSize: 32, 
                        marginBottom: 6,
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                      }}></i>
                      <div style={{ 
                        fontWeight: 700,
                        fontSize: 14,
                        textAlign: 'center',
                        lineHeight: 1.2
                      }}>
                        {btn.label}
                      </div>
                      <div style={{ 
                        fontSize: 11,
                        opacity: 0.8,
                        textAlign: 'center',
                        fontWeight: 500
                      }}>
                        {btn.description}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Menú inferior tipo app móvil */}
      <nav className="bottom-nav" aria-label="Menú principal">
        <div className="bottom-nav-inner">
          <NavLink className="bottom-nav-link" to="/" end>
            <i className="bi bi-house" aria-hidden="true"></i>
            <span>Inicio</span>
          </NavLink>
          {rol === 'admin' && (
            <NavLink className="bottom-nav-link" to="/dashboard">
              <i className="bi bi-speedometer2" aria-hidden="true"></i>
              <span>Dashboard</span>
            </NavLink>
          )}
          {rolesValesYGastos.includes(rol) && (
            <NavLink className="bottom-nav-link" to="/vales-servicio">
              <i className="bi bi-receipt" aria-hidden="true"></i>
              <span>Vales</span>
            </NavLink>
          )}
          {rolesValesYGastos.includes(rol) && (
            <NavLink className="bottom-nav-link" to="/vales-gasto">
              <i className="bi bi-cash-stack" aria-hidden="true"></i>
              <span>Gastos</span>
            </NavLink>
          )}
          {rol === 'admin' && (
            <NavLink className="bottom-nav-link" to="/crear-usuario">
              <i className="bi bi-person-plus" aria-hidden="true"></i>
              <span>Crear</span>
            </NavLink>
          )}
          {(rol === 'admin' || rol === 'anfitrion') && (
            <NavLink className="bottom-nav-link" to="/aprobar-vales-servicio">
              <i className="bi bi-check2-square" aria-hidden="true"></i>
              <span>Aprobar</span>
            </NavLink>
          )}
          {(rol === 'admin' || rol === 'anfitrion') && (
            <NavLink className="bottom-nav-link" to="/cuadre-diario">
              <i className="bi bi-table" aria-hidden="true"></i>
              <span>Cuadre</span>
            </NavLink>
          )}
          {rol && (
            <button
              className="bottom-nav-link border-0 bg-transparent"
              style={{outline: 'none'}}
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              type="button"
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
              <span>Salir</span>
            </button>
          )}
        </div>
      </nav>
      <div className="bottom-spacer"></div>

      {/* Información adicional */}
      <Row className="justify-content-center mt-3">
        <Col xs={12} md={10} lg={8}>
          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap">
            {/* Versión */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: 14,
              color: '#475569'
            }}>
              <i className="bi bi-info-circle me-2" style={{ color: '#6366f1', fontSize: 16 }}></i>
              <span className="me-2">Versión</span>
              <Badge bg="primary" style={{ fontSize: 12, fontWeight: 700 }}>
                v2.1.0
              </Badge>
            </div>

            {/* Estado del sistema */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: 14,
              color: '#059669'
            }}>
              <i className="bi bi-check-circle-fill me-2" style={{ color: '#10b981', fontSize: 16 }}></i>
              Sistema Activo
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
}

export default HomeObento;