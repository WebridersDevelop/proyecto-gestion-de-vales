import { Routes, Route, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ValesServicio from './pages/ValesServicio.jsx';
import ValesGasto from './pages/ValesGasto.jsx';
import CuadreDiario from './pages/CuadreDiario.jsx';
import AdminOnly from './pages/AdminOnly';
import CrearUsuario from './pages/CrearUsuario.jsx';
import AprobarValesServicio from './pages/AprobarValesServicio';
import PerfilUsuario from './pages/PerfilUsuario.jsx';
import './App.css';
import React, { useEffect } from 'react';
import InstallPWAButton from './InstallPWAButton';
import HomeObento from './pages/HomeObento';
import { getDeviceInfo } from './utils/styleUtils';

// Detectar plataforma al cargar la app
const deviceInfo = getDeviceInfo();

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { rol, logout, loading } = useAuth();
  const isLogin = location.pathname === '/';

  // Mostrar menú inferior solo si no es login
  const showBottomMenu = !isLogin;

  // Configuración específica para Android
  useEffect(() => {
    if (deviceInfo.isAndroid) {
      // Prevenir zoom en inputs
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        metaViewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
      }
      
      // Deshabilitar context menu en Android
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      
      // Optimizar scroll para Android
      document.body.style.overscrollBehavior = 'none';
      document.body.style.touchAction = 'pan-y';
    }
  }, []);

  // Redirigir anfitrión siempre al inicio
  useEffect(() => {
    if (!loading && rol === 'anfitrion' &&
      !['/', '/vales-servicio', '/vales-gasto', '/aprobar-vales-servicio', '/cuadre-diario', '/perfil'].includes(location.pathname)
    ) {
      navigate('/', { replace: true });
    }
    // Cambia aquí la lógica para los nuevos roles
    if (!loading && ['barbero', 'estilista', 'estetica'].includes(rol) &&
      !['/', '/vales-servicio', '/vales-gasto', '/perfil'].includes(location.pathname)
    ) {
      navigate('/', { replace: true });
    }
  }, [rol, location.pathname, navigate, loading]);

  if (loading) return <div className="text-center mt-5"><div className="spinner-border" /></div>;

  return (
    <>
      {/* Badge de rol elegante */}
      {rol && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 12,
          marginBottom: 8
        }}>
          <span style={{
            background: '#e0e7ff',
            color: '#3730a3',
            borderRadius: 12,
            padding: '4px 16px',
            fontWeight: 600,
            fontSize: 14,
            boxShadow: '0 1px 4px #0001'
          }}>
            Rol: {rol.charAt(0).toUpperCase() + rol.slice(1)}
          </span>
        </div>
      )}

      <main>
        <Routes>
          <Route path="/" element={rol ? <HomeObento /> : <Login />} />
          <Route path="/dashboard" element={
            rol === 'admin'
              ? <Dashboard />
              : <HomeObento />
          } />
          <Route path="/vales-servicio" element={
            (rol === 'admin' || rol === 'anfitrion' || ['barbero', 'estilista', 'estetica'].includes(rol))
              ? <ValesServicio />
              : <HomeObento />
          } />
          <Route path="/vales-gasto" element={
            (rol === 'admin' || rol === 'anfitrion' || ['barbero', 'estilista', 'estetica'].includes(rol))
              ? <ValesGasto />
              : <HomeObento />
          } />
          <Route path="/cuadre-diario" element={
            (rol === 'admin' || rol === 'anfitrion')
              ? <CuadreDiario />
              : <HomeObento />
          } />
          <Route path="/crear-usuario" element={
            rol === 'admin'
              ? <CrearUsuario />
              : <HomeObento />
          } />
          <Route path="/aprobar-vales-servicio" element={
            (rol === 'admin' || rol === 'anfitrion')
              ? <AprobarValesServicio />
              : <HomeObento />
          } />
          <Route path="/perfil" element={
            rol ? <PerfilUsuario /> : <Login />
          } />
        </Routes>
      </main>

      {/* Menú inferior tipo app móvil */}
      {showBottomMenu && (
        <nav className="bottom-nav" aria-label="Menú principal">
          <div className="bottom-nav-inner">
            <NavLink 
              className="bottom-nav-link" 
              to="/" 
              end
              style={{'--nav-color': '#22c55e'}}
            >
              <i className="bi bi-house-heart" aria-hidden="true"></i>
              <span>Inicio</span>
            </NavLink>
            {rol === 'admin' && (
              <NavLink 
                className="bottom-nav-link" 
                to="/dashboard"
                style={{'--nav-color': '#6366f1'}}
              >
                <i className="bi bi-speedometer2" aria-hidden="true"></i>
                <span>Dashboard</span>
              </NavLink>
            )}
            {(rol === 'admin' || rol === 'anfitrion' || ['barbero', 'estilista', 'estetica'].includes(rol)) && (
              <NavLink 
                className="bottom-nav-link" 
                to="/vales-servicio"
                style={{'--nav-color': '#3b82f6'}}
              >
                <i className="bi bi-receipt-cutoff" aria-hidden="true"></i>
                <span>Vales</span>
              </NavLink>
            )}
            {(rol === 'admin' || rol === 'anfitrion' || ['barbero', 'estilista', 'estetica'].includes(rol)) && (
              <NavLink 
                className="bottom-nav-link" 
                to="/vales-gasto"
                style={{'--nav-color': '#f59e0b'}}
              >
                <i className="bi bi-cash-coin" aria-hidden="true"></i>
                <span>Gastos</span>
              </NavLink>
            )}
            {rol === 'admin' && (
              <NavLink 
                className="bottom-nav-link" 
                to="/crear-usuario"
                style={{'--nav-color': '#10b981'}}
              >
                <i className="bi bi-person-plus-fill" aria-hidden="true"></i>
                <span>Crear</span>
              </NavLink>
            )}
            {(rol === 'admin' || rol === 'anfitrion') && (
              <NavLink 
                className="bottom-nav-link" 
                to="/aprobar-vales-servicio"
                style={{'--nav-color': '#8b5cf6'}}
              >
                <i className="bi bi-shield-check" aria-hidden="true"></i>
                <span>Aprobar</span>
              </NavLink>
            )}
            {(rol === 'admin' || rol === 'anfitrion') && (
              <NavLink 
                className="bottom-nav-link" 
                to="/cuadre-diario"
                style={{'--nav-color': '#06b6d4'}}
              >
                <i className="bi bi-table" aria-hidden="true"></i>
                <span>Cuadre</span>
              </NavLink>
            )}
            {rol && (
              <button 
                className="bottom-nav-link" 
                onClick={logout}
                style={{
                  '--nav-color': '#dc2626',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#dc2626'
                }}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#fee2e2';
                  e.target.style.borderRadius = '12px';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
                <span>Salir</span>
              </button>
            )}
          </div>
        </nav>
      )}
      <div className="bottom-spacer"></div>
      <InstallPWAButton />
    </>
  );
}

export default AppContent;
