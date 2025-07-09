import { Routes, Route, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ValesServicio from './pages/ValesServicio.jsx';
import ValesGasto from './pages/ValesGasto.jsx';
import CuadreDiario from './pages/CuadreDiario.jsx';
import AdminOnly from './pages/AdminOnly';
import CrearUsuario from './pages/CrearUsuario.jsx';
import AprobarValesServicio from './pages/AprobarValesServicio';
import './App.css';
import React, { useEffect } from 'react';
import InstallPWAButton from './InstallPWAButton';
import HomeObento from './pages/HomeObento';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { rol, logout, loading } = useAuth();
  const isLogin = location.pathname === '/';

  // Mostrar menú inferior solo si no es login
  const showBottomMenu = !isLogin;

  // Redirigir anfitrión siempre al inicio
  useEffect(() => {
    if (!loading && rol === 'anfitrion' &&
      !['/', '/vales-servicio', '/vales-gasto', '/aprobar-vales-servicio', '/cuadre-diario'].includes(location.pathname)
    ) {
      navigate('/', { replace: true });
    }
    // Cambia aquí la lógica para los nuevos roles
    if (!loading && ['barbero', 'estilista', 'estetica'].includes(rol) &&
      !['/', '/vales-servicio', '/vales-gasto'].includes(location.pathname)
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
        </Routes>
      </main>

      {/* Menú inferior tipo app móvil */}
      {showBottomMenu && (
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
            {(rol === 'admin' || rol === 'anfitrion' || ['barbero', 'estilista', 'estetica'].includes(rol)) && (
              <NavLink className="bottom-nav-link" to="/vales-servicio">
                <i className="bi bi-receipt" aria-hidden="true"></i>
                <span>Vales</span>
              </NavLink>
            )}
            {(rol === 'admin' || rol === 'anfitrion' || ['barbero', 'estilista', 'estetica'].includes(rol)) && (
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
      )}
      <div className="bottom-spacer"></div>
      <InstallPWAButton />
    </>
  );
}

export default AppContent;
