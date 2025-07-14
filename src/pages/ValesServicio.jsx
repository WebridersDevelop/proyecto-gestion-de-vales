import { useRef, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, Timestamp, onSnapshot, getDoc, runTransaction, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Form, Button, Card, Row, Col, Alert, Table, Badge, Spinner } from 'react-bootstrap';

function ValesServicio() {
  const { user, rol, nombre } = useAuth();
  
  const [servicio, setServicio] = useState('');
  const [valor, setValor] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [valesUsuario, setValesUsuario] = useState([]);
  const [valesGastoUsuario, setValesGastoUsuario] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaFiltro, setFechaFiltro] = useState(() => {
    // Por defecto mostrar solo el día actual
    const hoy = new Date();
    return hoy.toISOString().slice(0, 10);
  });
  const servicioRef = useRef(null);
  const valorRef = useRef(null);

  useEffect(() => {
    if (!user?.uid || !rol) return;
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'vales_servicio'), snap => {
      const vales = [];
      snap.forEach(docu => {
        const data = docu.data();
        
        // Determinar si mostrar el vale según el rol
        let mostrarVale = false;
        
        if (['admin', 'anfitrion'].includes(rol)) {
          // Admin y anfitrion ven todos los vales
          mostrarVale = true;
        } else if (['barbero', 'estilista', 'estetica'].includes(rol)) {
          // Barberos, estilistas y estetica ven sus propios vales
          mostrarVale = (data.peluqueroUid === user.uid);
        }
        
        if (mostrarVale) {
          vales.push({
            ...data,
            id: docu.id,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
          });
        }
      });
      vales.sort((a, b) => b.fecha - a.fecha);
      setValesUsuario(vales);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, rol, mensaje]);

  useEffect(() => {
    if (!user?.uid || !rol) return;
    const unsub = onSnapshot(collection(db, 'vales_gasto'), snap => {
      const vales = [];
      snap.forEach(docu => {
        const data = docu.data();
        
        // Determinar si mostrar el vale según el rol
        let mostrarVale = false;
        
        if (['admin', 'anfitrion'].includes(rol)) {
          // Admin y anfitrion ven todos los vales de gasto
          mostrarVale = true;
        } else if (['barbero', 'estilista', 'estetica'].includes(rol)) {
          // Barberos, estilistas y estetica ven sus propios vales de gasto
          mostrarVale = (data.peluqueroUid === user.uid);
        }
        
        if (mostrarVale) {
          vales.push({
            ...data,
            id: docu.id,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
          });
        }
      });
      setValesGastoUsuario(vales);
    });
    return () => unsub();
  }, [user?.uid, rol]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMensaje('');

    if (!servicio.trim() || !valor) {
      setMensaje('Completa todos los campos');
      setLoading(false);
      return;
    }
    if (isNaN(valor) || Number(valor) <= 0) {
      setMensaje('El valor debe ser un número positivo');
      setLoading(false);
      return;
    }

    try {
      // Verificar que tenemos el nombre del usuario
      let nombreUsuario = nombre;
      
      // Si no tenemos nombre del contexto, intentar obtenerlo directamente
      if (!nombreUsuario || nombreUsuario === 'Usuario sin nombre') {
        try {
          const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
          if (usuarioDoc.exists()) {
            const userData = usuarioDoc.data();
            nombreUsuario = userData.nombre || 'Usuario sin nombre configurado';
          } else {
            nombreUsuario = 'Usuario sin documento en BD';
          }
        } catch (error) {
          console.error('Error obteniendo nombre:', error);
          nombreUsuario = 'Error al obtener nombre';
        }
      }

      // --- SISTEMA DE CÓDIGOS CORRELATIVOS ---
      // Obtener el último número de vale para generar el siguiente
      const valesQuery = query(
        collection(db, 'vales_servicio'),
        where('codigo', '!=', null)
      );
      
      const valesSnapshot = await getDocs(valesQuery);
      let ultimoNumero = 0;
      
      // Buscar el número más alto
      valesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.codigo && data.codigo.startsWith('S-')) {
          const numero = parseInt(data.codigo.replace('S-', ''));
          if (!isNaN(numero) && numero > ultimoNumero) {
            ultimoNumero = numero;
          }
        }
      });
      
      // Generar el siguiente número
      const siguienteNumero = ultimoNumero + 1;
      const codigoServicio = `S-${siguienteNumero.toString().padStart(3, '0')}`;

      // Crear el vale directamente
      const valeRef = doc(collection(db, 'vales_servicio'));
      await setDoc(valeRef, {
        codigo: codigoServicio,
        servicio: servicio.trim(),
        valor: Number(valor),
        peluquero: nombreUsuario,
        peluqueroUid: user.uid,
        peluqueroEmail: user.email, // Agregar el email para compatibilidad con el dashboard
        fecha: Timestamp.now(),
        estado: 'pendiente'
      });

      setMensaje(`Vale creado exitosamente con código: ${codigoServicio}`);
      setServicio('');
      setValor('');
      servicioRef.current?.focus();
    } catch (error) {
      console.error('Error:', error);
      setMensaje(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar vales por fecha
  const valesFiltrados = fechaFiltro 
    ? valesUsuario.filter(vale => {
        const fechaVale = vale.fecha.toISOString().slice(0, 10);
        return fechaVale === fechaFiltro;
      })
    : valesUsuario; // Si no hay filtro de fecha (caso especial), mostrar todos

  // Calcular métricas del día o totales
  const totalGastosDia = fechaFiltro 
    ? valesGastoUsuario
        .filter(v => {
          const fechaVale = v.fecha.toISOString().slice(0, 10);
          return fechaVale === fechaFiltro && v.estado === 'aprobado';
        })
        .reduce((acc, v) => acc + (v.valor || 0), 0)
    : valesGastoUsuario
        .filter(v => v.estado === 'aprobado')
        .reduce((acc, v) => acc + (v.valor || 0), 0);

  const acumuladoDia = fechaFiltro
    ? valesFiltrados
        .filter(v => v.estado === 'aprobado')
        .reduce((acc, v) => acc + (getGanancia(v) || 0), 0)
    : valesUsuario
        .filter(v => v.estado === 'aprobado')
        .reduce((acc, v) => acc + (getGanancia(v) || 0), 0);

  const acumuladoNeto = acumuladoDia - totalGastosDia;

  // Función para calcular la ganancia real
  function getGanancia(vale) {
    if (vale.estado === 'aprobado') {
      // Determinar el porcentaje que le corresponde al profesional
      let porcentajeProfesional = 100; // Por defecto 100%
      
      if (vale.dividirPorDos) {
        if (typeof vale.dividirPorDos === 'string') {
          // Nuevo sistema con porcentajes específicos
          porcentajeProfesional = Number(vale.dividirPorDos);
        } else {
          // Sistema anterior (boolean) - 50%
          porcentajeProfesional = 50;
        }
      }
      
      // Calcular la base del servicio con el porcentaje
      const base = (Number(vale.valor) * porcentajeProfesional) / 100;
      
      // Sumar la comisión extra (no se divide)
      return base + (Number(vale.comisionExtra) || 0);
    }
    return null;
  }

  if (
    !['admin', 'anfitrion', 'barbero', 'estilista', 'estetica'].includes(rol)
  ) {
    return <Alert variant="danger" className="mt-4 text-center">No autorizado - Rol: {rol}</Alert>;
  }

  return (
    <div className="vales-servicio-container" style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh',
      padding: '20px 10px 140px 10px'
    }}>
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8} xl={7}>
          <Card className="shadow-sm border-0" style={{
            borderRadius: 24,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            overflow: 'hidden'
          }}>
            <Card.Body className="p-0">
              {/* Header modernizado */}
              <div style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                padding: '24px',
                color: 'white'
              }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <h4 className="mb-1 fw-bold" style={{ fontSize: '1.4rem' }}>
                      <i className="bi bi-scissors me-2"></i>
                      Vales de Servicio
                    </h4>
                    <p className="mb-0 opacity-90" style={{ fontSize: '0.95rem' }}>
                      {['admin', 'anfitrion'].includes(rol) 
                        ? 'Gestiona todos los vales de servicio' 
                        : 'Registra tus servicios realizados'
                      }
                    </p>
                  </div>
                  <div className="text-end">
                    <div style={{ 
                      background: 'rgba(255,255,255,0.15)', 
                      padding: '8px 12px', 
                      borderRadius: '8px',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <small className="d-block opacity-90">
                        {fechaFiltro ? `Registros del ${fechaFiltro}` : 'Total registros'}
                      </small>
                      <strong style={{ fontSize: '1.2rem' }}>{valesFiltrados.length}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulario modernizado */}
              <div style={{ padding: '24px' }}>
                <Form onSubmit={handleSubmit}>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label style={{ 
                          fontWeight: 600, 
                          color: '#374151', 
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <i className="bi bi-cut me-2 text-primary"></i>
                          Servicio Realizado
                        </Form.Label>
                        <Form.Control
                          ref={servicioRef}
                          type="text"
                          value={servicio}
                          onChange={(e) => setServicio(e.target.value)}
                          placeholder="Ej: Corte, Barba, Color..."
                          disabled={loading}
                          style={{
                            border: '2px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            fontSize: '0.95rem',
                            transition: 'all 0.2s ease',
                            backgroundColor: '#f8fafc'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label style={{ 
                          fontWeight: 600, 
                          color: '#374151', 
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <i className="bi bi-currency-dollar me-2 text-success"></i>
                          Valor del Servicio
                        </Form.Label>
                        <Form.Control
                          ref={valorRef}
                          type="number"
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          placeholder="0"
                          disabled={loading}
                          style={{
                            border: '2px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            fontSize: '0.95rem',
                            transition: 'all 0.2s ease',
                            backgroundColor: '#f8fafc'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  
                  <div className="mt-4 d-flex gap-3 align-items-center">
                    <Button
                      type="submit"
                      disabled={loading}
                      style={{
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                      onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                      {loading ? (
                        <>
                          <Spinner size="sm" className="me-2" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-plus-circle me-2"></i>
                          Registrar Vale
                        </>
                      )}
                    </Button>
                    
                    {mensaje && (
                      <Alert 
                        variant={mensaje.includes('Error') ? 'danger' : 'success'} 
                        className="mb-0 py-2 px-3 flex-1"
                        style={{ 
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          border: 'none'
                        }}
                      >
                        {mensaje}
                      </Alert>
                    )}
                  </div>
                </Form>
              </div>

              {/* Filtros y resumen del día */}
              <div style={{ 
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', 
                padding: '20px 24px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <Row className="g-3 align-items-center">
                  <Col md={4}>
                    <Form.Group className="mb-0">
                      <Form.Label style={{ 
                        fontWeight: 600, 
                        color: '#374151', 
                        fontSize: '0.9rem',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <i className="bi bi-calendar3 me-2 text-primary"></i>
                        Filtrar por fecha
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={fechaFiltro}
                        onChange={(e) => setFechaFiltro(e.target.value)}
                        placeholder="Seleccionar fecha..."
                        style={{
                          border: '2px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          fontSize: '0.9rem',
                          backgroundColor: 'white'
                        }}
                      />
                      <div className="mt-2 d-flex gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            const hoy = new Date();
                            setFechaFiltro(hoy.toISOString().slice(0, 10));
                          }}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <i className="bi bi-calendar-day me-1"></i>
                          Hoy
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => setFechaFiltro('')}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <i className="bi bi-calendar3 me-1"></i>
                          Todos
                        </Button>
                      </div>
                    </Form.Group>
                  </Col>
                  <Col md={8}>
                    <Row className="g-2">
                      <Col xs={6} md={3}>
                        <div style={{
                          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                          padding: '12px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          border: '1px solid #93c5fd'
                        }}>
                          <div style={{ color: '#1e40af', fontSize: '0.8rem', fontWeight: 500 }}>
                            Registros
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e3a8a' }}>
                            {valesFiltrados.length}
                          </div>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div style={{
                          background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                          padding: '12px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          border: '1px solid #86efac'
                        }}>
                        <div style={{ color: '#166534', fontSize: '0.8rem', fontWeight: 500 }}>
                          {fechaFiltro 
                            ? (fechaFiltro === new Date().toISOString().slice(0, 10) ? 'Ingresos de hoy' : 'Ingresos del día')
                            : 'Total ingresos'
                          }
                        </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#14532d' }}>
                            ${acumuladoDia.toLocaleString()}
                          </div>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div style={{
                          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          padding: '12px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          border: '1px solid #fcd34d'
                        }}>
                        <div style={{ color: '#92400e', fontSize: '0.8rem', fontWeight: 500 }}>
                          {fechaFiltro 
                            ? (fechaFiltro === new Date().toISOString().slice(0, 10) ? 'Gastos de hoy' : 'Gastos del día')
                            : 'Total gastos'
                          }
                        </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#78350f' }}>
                            ${totalGastosDia.toLocaleString()}
                          </div>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div style={{
                          background: `linear-gradient(135deg, ${acumuladoNeto >= 0 ? '#dcfce7' : '#fee2e2'} 0%, ${acumuladoNeto >= 0 ? '#bbf7d0' : '#fecaca'} 100%)`,
                          padding: '12px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          border: `1px solid ${acumuladoNeto >= 0 ? '#86efac' : '#fca5a5'}`
                        }}>
                          <div style={{ color: acumuladoNeto >= 0 ? '#166534' : '#991b1b', fontSize: '0.8rem', fontWeight: 500 }}>
                            Neto
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: acumuladoNeto >= 0 ? '#14532d' : '#7f1d1d' }}>
                            ${acumuladoNeto.toLocaleString()}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </div>

              {/* Lista de vales modernizada */}
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" style={{ color: '#2563eb' }} />
                  <p className="mt-3 text-muted">Cargando vales...</p>
                </div>
              ) : (
                <>
                  <div style={{
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    padding: '16px 24px',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0" style={{ 
                        fontWeight: 600, 
                        color: '#374151',
                        fontSize: '1rem'
                      }}>
                        <i className="bi bi-list-ul me-2 text-primary"></i>
                        {['admin', 'anfitrion'].includes(rol) 
                          ? (fechaFiltro 
                              ? (fechaFiltro === new Date().toISOString().slice(0, 10) 
                                  ? 'Todos los vales de hoy' 
                                  : `Todos los vales del ${fechaFiltro}`)
                              : 'Todos los vales'
                            )
                          : (fechaFiltro 
                              ? (fechaFiltro === new Date().toISOString().slice(0, 10) 
                                  ? 'Tus vales de hoy' 
                                  : `Tus vales del ${fechaFiltro}`)
                              : 'Todos tus vales'
                            )
                        }
                      </h6>
                      <span style={{ 
                        background: '#2563eb', 
                        color: 'white', 
                        padding: '4px 12px', 
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}>
                        {valesFiltrados.length} registros
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ padding: '0 12px 24px 12px' }}>
                    {/* Tabla compacta para todas las pantallas */}
                    <div style={{ 
                      overflowX: 'auto', 
                      borderRadius: '12px', 
                      border: '1px solid #e2e8f0',
                      background: '#fff'
                    }}>
                      <Table className="mb-0" style={{ 
                        fontSize: '0.8rem',
                        background: '#fff',
                        minWidth: '100%'
                      }}>
                        <thead style={{ backgroundColor: '#f8fafc' }}>
                          <tr>
                            {/* Columnas adaptativas según el tamaño de pantalla */}
                            <th className="d-none d-md-table-cell" style={{padding: '8px 12px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Código</th>
                            {['admin', 'anfitrion'].includes(rol) && (
                              <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Profesional</th>
                            )}
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Servicio</th>
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Valor</th>
                            <th className="d-none d-sm-table-cell" style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>%</th>
                            <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Comisión</th>
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Total</th>
                            <th className="d-none d-sm-table-cell" style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Fecha</th>
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Hora</th>
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Estado</th>
                            <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Aprobado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {valesFiltrados.length === 0 ? (
                            <tr>
                              <td colSpan={['admin', 'anfitrion'].includes(rol) ? 11 : 10} className="text-center text-muted py-4" style={{ fontSize: '0.9rem' }}>
                                <i className="bi bi-info-circle" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}></i>
                                {fechaFiltro 
                                  ? (fechaFiltro === new Date().toISOString().slice(0, 10) 
                                      ? 'No hay vales registrados hoy.'
                                      : `No hay vales para la fecha ${fechaFiltro}.`)
                                  : 'No hay vales registrados.'
                                }
                              </td>
                            </tr>
                          ) : (
                            valesFiltrados.map(vale => (
                              <tr key={vale.id} style={{ 
                                borderBottom: '1px solid #f1f5f9',
                                borderLeft: `3px solid ${
                                  vale.estado === 'aprobado' ? '#22c55e' 
                                  : vale.estado === 'rechazado' ? '#dc3545' 
                                  : '#f59e42'
                                }`
                              }}>
                                {/* Código - Solo en pantallas md+ */}
                                <td className="d-none d-md-table-cell" style={{padding: '8px 12px'}}>
                                  <strong style={{ color: '#2563eb', fontSize: '0.8rem' }}>
                                    {vale.codigo || 'S-000'}
                                  </strong>
                                </td>
                                
                                {/* Profesional - Solo para admin/anfitrion en pantallas lg+ */}
                                {['admin', 'anfitrion'].includes(rol) && (
                                  <td className="d-none d-lg-table-cell" style={{padding: '8px 6px'}}>
                                    <span style={{ 
                                      color: '#059669', 
                                      fontWeight: 600, 
                                      fontSize: '0.75rem' 
                                    }}>
                                      {vale.peluquero || 'Sin nombre'}
                                    </span>
                                  </td>
                                )}
                                
                                {/* Servicio - Siempre visible pero más compacto en móvil */}
                                <td style={{padding: '8px 6px', color: '#374151', maxWidth: '120px'}}>
                                  <div style={{ 
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis',
                                    fontWeight: 500,
                                    fontSize: '0.8rem'
                                  }}>
                                    {vale.servicio}
                                  </div>
                                  {/* En móvil, mostrar código debajo del servicio */}
                                  <div className="d-md-none" style={{ 
                                    fontSize: '0.7rem', 
                                    color: '#2563eb', 
                                    fontWeight: 600 
                                  }}>
                                    {vale.codigo || 'S-000'}
                                  </div>
                                </td>
                                
                                {/* Valor - Siempre visible */}
                                <td style={{padding: '8px 6px', fontWeight: 600, color: '#1f2937', fontSize: '0.8rem'}}>
                                  ${vale.valor?.toLocaleString()}
                                </td>
                                
                                {/* Porcentaje - Solo en pantallas sm+ */}
                                <td className="d-none d-sm-table-cell" style={{padding: '8px 6px'}}>
                                  <span style={{ 
                                    color: '#4338ca',
                                    fontWeight: 600,
                                    fontSize: '0.75rem'
                                  }}>
                                    {vale.dividirPorDos ? (
                                      typeof vale.dividirPorDos === 'string' 
                                        ? `${vale.dividirPorDos}%`
                                        : '50%'
                                    ) : '100%'}
                                  </span>
                                </td>
                                
                                {/* Comisión - Solo en pantallas lg+ */}
                                <td className="d-none d-lg-table-cell" style={{padding: '8px 6px'}}>
                                  {vale.comisionExtra > 0 ? (
                                    <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>
                                      ${vale.comisionExtra?.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>-</span>
                                  )}
                                </td>
                                
                                {/* Total - Siempre visible */}
                                <td style={{padding: '8px 6px'}}>
                                  <strong style={{ 
                                    color: vale.estado === 'aprobado' ? '#22c55e' : '#64748b',
                                    fontSize: '0.8rem'
                                  }}>
                                    ${getGanancia(vale)?.toLocaleString() || '0'}
                                  </strong>
                                  {/* En móvil, mostrar % y comisión como texto pequeño */}
                                  <div className="d-sm-none" style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                                    {vale.dividirPorDos ? (
                                      typeof vale.dividirPorDos === 'string' 
                                        ? `${vale.dividirPorDos}%`
                                        : '50%'
                                    ) : '100%'}
                                    {vale.comisionExtra > 0 && ` +$${vale.comisionExtra?.toLocaleString()}`}
                                  </div>
                                </td>
                                
                                {/* Fecha - Solo en pantallas sm+ */}
                                <td className="d-none d-sm-table-cell" style={{padding: '8px 6px', fontSize: '0.75rem', color: '#64748b'}}>
                                  {vale.fecha.toLocaleDateString('es-ES', { 
                                    day: '2-digit', 
                                    month: '2-digit' 
                                  })}
                                </td>
                                
                                {/* Hora - Siempre visible */}
                                <td style={{padding: '8px 6px', fontSize: '0.75rem', color: '#64748b'}}>
                                  <strong style={{ color: '#2563eb', fontSize: '0.75rem' }}>
                                    {vale.fecha.toLocaleTimeString('es-ES', { 
                                      hour: '2-digit', 
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </strong>
                                  {/* En móvil, mostrar fecha debajo de la hora */}
                                  <div className="d-sm-none" style={{ 
                                    fontSize: '0.65rem', 
                                    color: '#64748b', 
                                    marginTop: '2px' 
                                  }}>
                                    {vale.fecha.toLocaleDateString('es-ES', { 
                                      day: '2-digit', 
                                      month: '2-digit' 
                                    })}
                                  </div>
                                </td>
                                
                                {/* Estado - Siempre visible */}
                                <td style={{padding: '8px 6px'}}>
                                  <span className={`badge ${
                                    vale.estado === 'aprobado'
                                      ? 'bg-success'
                                      : vale.estado === 'rechazado'
                                      ? 'bg-danger'
                                      : 'bg-warning text-dark'
                                  }`} style={{ 
                                    fontSize: '0.65rem', 
                                    fontWeight: 600, 
                                    padding: '3px 6px',
                                    borderRadius: '4px'
                                  }}>
                                    {vale.estado === 'aprobado' ? 'OK' 
                                     : vale.estado === 'rechazado' ? 'X' 
                                     : 'P'}
                                  </span>
                                  {/* En móvil, quitar la fecha de aquí ya que está en la columna Hora */}
                                </td>
                                
                                {/* Aprobado por - Solo en pantallas lg+ */}
                                <td className="d-none d-lg-table-cell" style={{padding: '8px 6px'}}>
                                  {vale.estado === 'aprobado' && vale.aprobadoPor ? (
                                    <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.75rem' }}>
                                      <i className="bi bi-check-circle" style={{marginRight: 2}}></i>
                                      {vale.aprobadoPor.substring(0, 8)}...
                                    </span>
                                  ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
                                    <span style={{ color: '#dc3545', fontWeight: 600, fontSize: '0.75rem' }}>
                                      <i className="bi bi-x-circle" style={{marginRight: 2}}></i>
                                      {vale.aprobadoPor.substring(0, 8)}...
                                    </span>
                                  ) : (
                                    <span className="text-secondary" style={{ fontSize: '0.75rem' }}>-</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function getHoyLocal() {
  // Usar UTC para evitar problemas de zona horaria
  const hoy = new Date();
  const utc = new Date(hoy.getTime() + hoy.getTimezoneOffset() * 60000);
  const offset = -5; // GMT-5 para Colombia
  const colombiaTime = new Date(utc.getTime() + (offset * 3600000));
  const fechaLocal = colombiaTime.toISOString().slice(0, 10);
  return fechaLocal;
}

export default ValesServicio;