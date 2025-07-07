import { Routes, Route, Link, useLocation, useNavigate, NavLink } from 'react-router-dom'; // agrega useNavigate
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
  const { rol, logout, loading } = useAuth(); // <-- agrega loading si lo tienes
  const isLogin = location.pathname === '/';

  // Menú inferior solo si no es login
  const showBottomMenu = !isLogin;

  // Redirección automática para peluquero SOLO cuando el rol ya está definido
  React.useEffect(() => {
    if (
      !loading && // <-- solo cuando terminó de cargar
      rol === 'peluquero' &&
      !['/vales-servicio', '/vales-gasto', '/'].includes(location.pathname)
    ) {
      navigate('/vales-servicio', { replace: true });
    }
  }, [rol, location.pathname, navigate, loading]);

  // Mientras carga, puedes mostrar un spinner:
  if (loading) return <div className="text-center mt-5"><div className="spinner-border" /></div>;

  return (
    <>
      {/* Mensaje de depuración del rol */}
      <p style={{color: 'black', textAlign: 'center'}}>Rol actual: {rol ? rol : 'No definido'}</p>

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

      {/* Menú inferior tipo app móvil, blanco y negro */}
      {showBottomMenu && (
        <nav className="bottom-nav shadow-sm">
          <div className="bottom-nav-inner">
            {/* Dashboard: solo admin */}
            {rol === 'admin' && (
              <NavLink
                className="bottom-nav-link"
                to="/dashboard"
              >
                <i className="bi bi-speedometer2"></i>
                <span>Dashboard</span>
              </NavLink>
            )}
            {/* Vales Servicio: admin, anfitrion, peluquero */}
            {(rol === 'admin' || rol === 'anfitrion' || rol === 'peluquero') && (
              <NavLink className="bottom-nav-link" to="/vales-servicio">
                <i className="bi bi-receipt"></i>
                <span>Vales</span>
              </NavLink>
            )}
            {/* Vales Gasto: admin, anfitrion, peluquero */}
            {(rol === 'admin' || rol === 'anfitrion' || rol === 'peluquero') && (
              <NavLink className="bottom-nav-link" to="/vales-gasto">
                <i className="bi bi-cash-stack"></i>
                <span>Gastos</span>
              </NavLink>
            )}
            {/* Crear Usuario: solo admin */}
            {rol === 'admin' && (
              <NavLink className="bottom-nav-link" to="/crear-usuario">
                <i className="bi bi-person-plus"></i>
                <span>Crear</span>
              </NavLink>
            )}
            {/* Aprobar: admin y anfitrion */}
            {(rol === 'admin' || rol === 'anfitrion') && (
              <NavLink className="bottom-nav-link" to="/aprobar-vales-servicio">
                <i className="bi bi-check2-square"></i>
                <span>Aprobar</span>
              </NavLink>
            )}
            {/* Cuadre Diario: admin y anfitrion */}
            {(rol === 'admin' || rol === 'anfitrion') && (
              <NavLink className="bottom-nav-link" to="/cuadre-diario">
                <i className="bi bi-table"></i>
                <span>Cuadre</span>
              </NavLink>
            )}
            {/* Logout: todos los roles */}
            {rol && (
              <button
                className="bottom-nav-link border-0 bg-transparent"
                style={{outline: 'none'}}
                onClick={logout}
                title="Cerrar sesión"
              >
                <i className="bi bi-box-arrow-right"></i>
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
