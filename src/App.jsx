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
import React from 'react';
import InstallPWAButton from './InstallPWAButton';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { rol, logout, loading } = useAuth();
  const isLogin = location.pathname === '/';

  // Mostrar menú inferior solo si no es login
  const showBottomMenu = !isLogin;

  // Redirección automática para peluquero
  React.useEffect(() => {
    if (
      !loading &&
      rol === 'peluquero' &&
      !['/vales-servicio', '/vales-gasto', '/'].includes(location.pathname)
    ) {
      navigate('/vales-servicio', { replace: true });
    }
  }, [rol, location.pathname, navigate, loading]);

  if (loading) return <div className="text-center mt-5"><div className="spinner-border" /></div>;

  return (
    <>
      {/* Mensaje de depuración del rol */}
      <p style={{color: 'black', textAlign: 'center'}}>Rol actual: {rol ? rol : 'No definido'}</p>

      <main>
        {isLogin ? (
          <Routes>
            <Route path="/" element={<Login />} />
          </Routes>
        ) : (
          <div className="container" style={{ paddingBottom: 70 }}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/dashboard" element={
                <AdminOnly>
                  <Dashboard />
                </AdminOnly>
              } />
              <Route path="/vales-servicio" element={<ValesServicio />} />
              <Route path="/vales-gasto" element={<ValesGasto />} />
              <Route path="/cuadre-diario" element={
                <AdminOnly>
                  <CuadreDiario />
                </AdminOnly>
              } />
              <Route path="/crear-usuario" element={<CrearUsuario />} />
              {(rol === 'admin' || rol === 'anfitrion') && (
                <Route path="/aprobar-vales-servicio" element={<AprobarValesServicio />} />
              )}
            </Routes>
          </div>
        )}

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
              {(rol === 'admin' || rol === 'anfitrion' || rol === 'peluquero') && (
                <NavLink className="bottom-nav-link" to="/vales-servicio">
                  <i className="bi bi-receipt" aria-hidden="true"></i>
                  <span>Vales</span>
                </NavLink>
              )}
              {(rol === 'admin' || rol === 'anfitrion' || rol === 'peluquero') && (
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
      </main>
      <InstallPWAButton />
    </>
  );
}

export default AppContent;
