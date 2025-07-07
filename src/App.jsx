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
        <div className="container mt-4" style={{ paddingBottom: 70 }}>
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
        <nav className="navbar bg-white border-top fixed-bottom">
          <div className="container-fluid d-flex justify-content-around flex-nowrap overflow-auto" style={{maxWidth: '100vw'}}>
            {/* Dashboard: solo admin */}
            {rol === 'admin' && (
              <NavLink
                className="nav-link text-center text-dark"
                to="/dashboard"
              >
                <i className="bi bi-speedometer2" style={{fontSize: 18}}></i><br />
                <small style={{fontSize: 10}}>Dashboard</small>
              </NavLink>
            )}
            {/* Vales Servicio: admin, anfitrion, peluquero */}
            {(rol === 'admin' || rol === 'anfitrion' || rol === 'peluquero') && (
              <Link className="nav-link text-center text-dark" to="/vales-servicio">
                <i className="bi bi-receipt" style={{fontSize: 22}}></i><br />
                <small>Vales</small>
              </Link>
            )}
            {/* Vales Gasto: admin, anfitrion, peluquero */}
            {(rol === 'admin' || rol === 'anfitrion' || rol === 'peluquero') && (
              <Link className="nav-link text-center text-dark" to="/vales-gasto">
                <i className="bi bi-cash-stack" style={{fontSize: 22}}></i><br />
                <small>Gastos</small>
              </Link>
            )}
            {/* Crear Usuario: solo admin */}
            {rol === 'admin' && (
              <Link className="nav-link text-center text-dark" to="/crear-usuario">
                <i className="bi bi-person-plus" style={{fontSize: 22}}></i><br />
                <small>Crear Usuario</small>
              </Link>
            )}
            {/* Aprobar: admin y anfitrion */}
            {(rol === 'admin' || rol === 'anfitrion') && (
              <Link className="nav-link text-center text-dark" to="/aprobar-vales-servicio">
                <i className="bi bi-check2-square" style={{fontSize: 22}}></i><br />
                <small>Aprobar</small>
              </Link>
            )}
            {/* Cuadre Diario: admin y anfitrion */}
            {(rol === 'admin' || rol === 'anfitrion') && (
              <Link className="nav-link text-center text-dark" to="/cuadre-diario">
                <i className="bi bi-table" style={{fontSize: 22}}></i><br />
                <small>Cuadre</small>
              </Link>
            )}
            {/* Logout: todos los roles */}
            {rol && (
              <button
                className="nav-link text-center text-dark border-0 bg-transparent"
                style={{outline: 'none'}}
                onClick={logout}
                title="Cerrar sesión"
              >
                <i className="bi bi-box-arrow-right" style={{fontSize: 22}}></i><br />
                <small>Salir</small>
              </button>
            )}
          </div>
        </nav>
      )}
    </>
  );
}

export default AppContent;
