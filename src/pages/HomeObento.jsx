import { useAuth } from '../context/AuthContext';
import { useNavigate, NavLink } from 'react-router-dom';
import { Row, Col, Card } from 'react-bootstrap';

const buttonStyles = {
  base: {
    minWidth: 130,
    minHeight: 120,
    fontSize: 19,
    border: 'none',
    borderRadius: 18,
    boxShadow: '0 2px 12px #0002',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.13s, box-shadow 0.13s',
    margin: 12,
    cursor: 'pointer',
    fontWeight: 700,
    outline: 'none',
    background: '#f3f4f6',
    color: '#1e293b',
    gap: 6
  },
  dashboard: { background: '#e0e7ff', color: '#3730a3' },
  vales: { background: '#d1fae5', color: '#047857' },
  gastos: { background: '#fee2e2', color: '#b91c1c' },
  crear: { background: '#fef9c3', color: '#b45309' },
  aprobar: { background: '#f3e8ff', color: '#7c3aed' },
  cuadre: { background: '#e0f2fe', color: '#0369a1' },
  salir: { background: '#fff1f2', color: '#be123c', border: '2px solid #be123c' }
};

function HomeObento() {
  const { rol, logout } = useAuth();
  const navigate = useNavigate();

  // Define los roles que pueden ver vales y gastos
  const rolesValesYGastos = ['admin', 'anfitrion', 'barbero', 'estilista', 'estetica'];

  const botones = [
    ...(rol === 'admin' ? [{
      icon: 'bi-speedometer2',
      label: 'Dashboard',
      to: '/dashboard',
      style: buttonStyles.dashboard
    }] : []),
    ...(rolesValesYGastos.includes(rol) ? [{
      icon: 'bi-receipt',
      label: 'Vales',
      to: '/vales-servicio',
      style: buttonStyles.vales
    }] : []),
    ...(rolesValesYGastos.includes(rol) ? [{
      icon: 'bi-cash-stack',
      label: 'Gastos',
      to: '/vales-gasto',
      style: buttonStyles.gastos
    }] : []),
    ...(rol === 'admin' ? [{
      icon: 'bi-person-plus',
      label: 'Crear Usuario',
      to: '/crear-usuario',
      style: buttonStyles.crear
    }] : []),
    ...(rol === 'admin' || rol === 'anfitrion' ? [{
      icon: 'bi-check2-square',
      label: 'Aprobar Vales',
      to: '/aprobar-vales-servicio',
      style: buttonStyles.aprobar
    }] : []),
    ...(rol === 'admin' || rol === 'anfitrion' ? [{
      icon: 'bi-table',
      label: 'Cuadre',
      to: '/cuadre-diario',
      style: buttonStyles.cuadre
    }] : []),
    {
      icon: 'bi-box-arrow-right',
      label: 'Salir',
      action: logout,
      style: buttonStyles.salir
    }
  ];

  return (
    <>
      <Row className="justify-content-center mt-4">
        <Col xs={12} md={8} lg={6}>
          <Card className="shadow-sm border-0" style={{borderRadius: 22, background: "#fff"}}>
            <Card.Body>
              <Card.Title className="mb-4 text-center" style={{fontWeight: 700, letterSpacing: '-1px', fontSize: 26, color: "#6366f1"}}>
                <i className="bi bi-house-door me-2"></i>Bienvenido
              </Card.Title>
              <div className="d-flex flex-wrap justify-content-center gap-3" style={{marginBottom: 10}}>
                {botones.map((btn, i) => (
                  <button
                    key={btn.label}
                    type="button"
                    style={{
                      ...buttonStyles.base,
                      ...btn.style
                    }}
                    onClick={() => btn.to ? navigate(btn.to) : btn.action()}
                    onMouseOver={e => {
                      e.currentTarget.style.transform = 'scale(1.07)';
                      e.currentTarget.style.boxShadow = '0 4px 18px #0002';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = buttonStyles.base.boxShadow;
                    }}
                  >
                    <i className={`bi ${btn.icon}`} style={{fontSize: 40, marginBottom: 8}}></i>
                    {btn.label}
                  </button>
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

      {/* Versión */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: '#f8fafc',
          borderRadius: 12,
          boxShadow: '0 1px 6px #0001',
          border: '1.5px solid #e5e7eb',
          padding: '6px 18px',
          fontWeight: 700,
          fontSize: 16,
          color: '#2563eb',
          letterSpacing: '0.02em',
          margin: '8px 0'
        }}
      >
        <i className="bi bi-info-circle" style={{marginRight: 8, color: '#6366f1', fontSize: 18}}></i>
        <span style={{marginRight: 6}}>Versión</span>
        <span style={{
          background: '#e0e7ef',
          color: '#2563eb',
          borderRadius: 8,
          padding: '2px 10px',
          fontWeight: 800,
          fontSize: 15,
          marginLeft: 4
        }}>
          v1.1.1
        </span>
      </div>
    </>
  );
}

export default HomeObento;