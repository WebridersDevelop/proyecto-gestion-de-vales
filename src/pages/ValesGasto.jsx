import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { runTransaction, getDoc, doc, collection, setDoc, Timestamp, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Form, Button, Card, Row, Col, Alert, Table, Badge, Spinner } from 'react-bootstrap';

function ValesGasto() {
  const { user, rol } = useAuth();
  const [concepto, setConcepto] = useState('');
  const [valor, setValor] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nombreActual, setNombreActual] = useState('');
  const [valesUsuario, setValesUsuario] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaFiltro, setFechaFiltro] = useState(''); // Inicia vacío para mostrar todos
  const conceptoRef = useRef(null);
  const valorRef = useRef(null);

  useEffect(() => {
    const fetchNombre = async () => {
      if (user?.uid) {
        const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
        setNombreActual(usuarioDoc.exists() && usuarioDoc.data().nombre ? usuarioDoc.data().nombre : '');
      }
    };
    fetchNombre();
  }, [user]);

  useEffect(() => {
    if (!user?.uid || !rol) return;
    
    setLoading(true);
    
    const unsub = onSnapshot(collection(db, 'vales_gasto'), snap => {
      const vales = [];
      
      snap.forEach(docu => {
        const data = docu.data();
        
        // SEGURIDAD: Filtrado estricto - TODOS los usuarios solo ven SUS PROPIOS vales
        // La gestión completa de todos los vales se realiza en la sección de aprobación
        let mostrarVale = false;
        
        if (['admin', 'anfitrion', 'barbero', 'estilista', 'estetica'].includes(rol)) {
          // SEGURIDAD: TODOS los roles autorizados SOLO ven SUS PROPIOS vales
          // Comparación estricta de UID para garantizar privacidad total
          mostrarVale = (data.peluqueroUid === user.uid);
        } else {
          // SEGURIDAD: Cualquier otro rol no puede ver vales
          mostrarVale = false;
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
    
    // Cleanup function para prevenir múltiples listeners
    return () => {
      if (unsub) {
        unsub();
      }
    };
  }, [user?.uid, rol]); // Removido 'mensaje' de las dependencias

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMensaje('');
    if (!concepto.trim() || !valor) {
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
      let nombre = nombreActual;
      if (!nombre) {
        const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
        nombre = usuarioDoc.exists() && usuarioDoc.data().nombre ? usuarioDoc.data().nombre : 'Sin nombre';
      }

      // --- CORRELATIVO DIARIO CON TRANSACCIÓN PARA GASTOS ---
      const hoy = getHoyLocal(); // "YYYY-MM-DD"
      const contadorRef = doc(db, 'contadores', `vales_gasto_${hoy}`);
      let nuevoNumero = 1;
      await runTransaction(db, async (transaction) => {
        const contadorDoc = await transaction.get(contadorRef);
        if (contadorDoc.exists()) {
          nuevoNumero = Number(contadorDoc.data().numero) + 1;
          transaction.update(contadorRef, { numero: nuevoNumero });
        } else {
          transaction.set(contadorRef, { numero: 1 });
        }
      });
      const codigoVale = `G-${String(nuevoNumero).padStart(3, '0')}`;

      const valesRef = collection(db, 'vales_gasto');
      const docRef = doc(valesRef);

      await setDoc(docRef, {
        concepto: concepto.trim(),
        valor: Number(valor),
        peluqueroUid: user.uid,
        peluqueroEmail: user.email,
        peluqueroNombre: nombre,
        estado: 'pendiente',
        aprobadoPor: '',
        fecha: Timestamp.now(),
        codigo: codigoVale
      });

      setConcepto('');
      setValor('');
      // Quita el foco de los campos para ocultar el teclado
      if (conceptoRef.current) conceptoRef.current.blur();
      if (valorRef.current) valorRef.current.blur();

      setMensaje('¡Vale de gasto enviado correctamente!');
      // Mantén el botón deshabilitado mientras se muestra el mensaje
      setTimeout(() => {
        setMensaje('');
        setLoading(false);
      }, 2000);
    } catch (error) {
      setMensaje('Error al enviar el vale');
      setTimeout(() => setMensaje(''), 2000);
      setLoading(false);
    }
  }, [loading, concepto, valor, nombreActual, user]);

  // Filtrar vales por fecha (si se especifica una fecha)
  const valesFiltrados = fechaFiltro 
    ? valesUsuario.filter(vale => {
        const fechaVale = vale.fecha.toISOString().slice(0, 10);
        return fechaVale === fechaFiltro;
      })
    : valesUsuario; // Si no hay filtro de fecha, mostrar todos

  // Calcular métricas del día (solo si hay filtro de fecha específico)
  const acumuladoDia = fechaFiltro
    ? valesFiltrados
        .filter(v => v.estado === 'aprobado')
        .reduce((acc, v) => acc + (Number(v.valor) || 0), 0)
    : valesFiltrados
        .filter(v => v.estado === 'aprobado')
        .reduce((acc, v) => acc + (Number(v.valor) || 0), 0);

  // Cambia aquí la lógica de acceso para los nuevos roles
  if (
    !['admin', 'anfitrion', 'barbero', 'estilista', 'estetica'].includes(rol)
  ) {
    return <Alert variant="danger" className="mt-4 text-center">No autorizado</Alert>;
  }

  return (
    <div className="vales-gasto-container" style={{
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
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                padding: '24px',
                color: 'white'
              }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <h4 className="mb-1 fw-bold" style={{ fontSize: '1.4rem' }}>
                      <i className="bi bi-cash-stack me-2"></i>
                      Vales de Gasto
                    </h4>
                    <p className="mb-0 opacity-90" style={{ fontSize: '0.95rem' }}>
                      Registra y gestiona tus gastos operativos
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
              {(['barbero', 'estilista', 'estetica', 'admin', 'anfitrion'].includes(rol)) && (
                <div style={{ padding: '24px' }}>
                  <Form onSubmit={handleSubmit}>
                    <Row className="g-3">
                      <Col md={7}>
                        <Form.Group>
                          <Form.Label style={{ 
                            fontWeight: 600, 
                            color: '#374151', 
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <i className="bi bi-receipt me-2 text-danger"></i>
                            Concepto del Gasto
                          </Form.Label>
                          <Form.Control
                            ref={conceptoRef}
                            type="text"
                            value={concepto}
                            onChange={(e) => setConcepto(e.target.value)}
                            placeholder="Ej: Compra de insumos, materiales..."
                            disabled={loading}
                            style={{
                              border: '2px solid #e2e8f0',
                              borderRadius: '12px',
                              padding: '12px 16px',
                              fontSize: '0.95rem',
                              transition: 'all 0.2s ease',
                              backgroundColor: '#f8fafc'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#ef4444'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={5}>
                        <Form.Group>
                          <Form.Label style={{ 
                            fontWeight: 600, 
                            color: '#374151', 
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <i className="bi bi-currency-dollar me-2 text-danger"></i>
                            Valor del Gasto
                          </Form.Label>
                          <Form.Control
                            ref={valorRef}
                            type="number"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            placeholder="0"
                            disabled={loading}
                            min={1}
                            style={{
                              border: '2px solid #e2e8f0',
                              borderRadius: '12px',
                              padding: '12px 16px',
                              fontSize: '0.95rem',
                              transition: 'all 0.2s ease',
                              backgroundColor: '#f8fafc'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#ef4444'}
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
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '12px 24px',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
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
                            Registrar Vale de Gasto
                          </>
                        )}
                      </Button>
                      
                      {mensaje && (
                        <Alert 
                          variant={mensaje.includes('Error') || mensaje.includes('Error') ? 'danger' : 'success'} 
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
              )}

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
                        <i className="bi bi-calendar3 me-2 text-danger"></i>
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
                      {fechaFiltro && (
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="mt-2"
                          onClick={() => setFechaFiltro('')}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <i className="bi bi-x-circle me-1"></i>
                          Mostrar todos
                        </Button>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={8}>
                    <Row className="g-2">
                      <Col xs={6} md={4}>
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
                      <Col xs={6} md={4}>
                        <div style={{
                          background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
                          padding: '12px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          border: '1px solid #f87171'
                        }}>
                          <div style={{ color: '#991b1b', fontSize: '0.8rem', fontWeight: 500 }}>
                            {fechaFiltro ? 'Tus gastos del día' : 'Tus gastos totales'}
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#7f1d1d' }}>
                            ${acumuladoDia.toLocaleString()}
                          </div>
                        </div>
                      </Col>
                      <Col xs={12} md={4}>
                        <div style={{
                          background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                          padding: '12px',
                          borderRadius: '12px',
                          textAlign: 'center',
                          border: '1px solid #d1d5db'
                        }}>
                          <div style={{ color: '#374151', fontSize: '0.8rem', fontWeight: 500 }}>
                            Tus pendientes
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111827' }}>
                            {valesFiltrados.filter(v => v.estado === 'pendiente').length}
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
                  <Spinner animation="border" style={{ color: '#ef4444' }} />
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
                        <i className="bi bi-list-ul me-2 text-danger"></i>
                        {fechaFiltro ? `Tus vales del ${fechaFiltro}` : 'Todos tus vales'}
                      </h6>
                      <span style={{ 
                        background: '#ef4444', 
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
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Concepto</th>
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Valor</th>
                            <th className="d-none d-sm-table-cell" style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Fecha</th>
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Hora</th>
                            <th style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Estado</th>
                            <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, color: '#374151', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem'}}>Aprobado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {valesFiltrados.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center text-muted py-4" style={{ fontSize: '0.9rem' }}>
                                <i className="bi bi-info-circle" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}></i>
                                {fechaFiltro 
                                  ? `No tienes vales para la fecha ${fechaFiltro}.`
                                  : 'No tienes vales registrados.'
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
                                  <strong style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                                    {vale.codigo || 'G-000'}
                                  </strong>
                                </td>
                                
                                {/* Concepto - Siempre visible pero más compacto en móvil */}
                                <td style={{padding: '8px 6px', color: '#374151', maxWidth: '120px'}}>
                                  <div style={{ 
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis',
                                    fontWeight: 500,
                                    fontSize: '0.8rem'
                                  }}>
                                    {vale.concepto}
                                  </div>
                                  {/* En móvil, mostrar código debajo del concepto */}
                                  <div className="d-md-none" style={{ 
                                    fontSize: '0.7rem', 
                                    color: '#ef4444', 
                                    fontWeight: 600 
                                  }}>
                                    {vale.codigo || 'G-000'}
                                  </div>
                                </td>
                                
                                {/* Valor - Siempre visible */}
                                <td style={{padding: '8px 6px', fontWeight: 600, color: '#ef4444', fontSize: '0.8rem'}}>
                                  ${Number(vale.valor)?.toLocaleString()}
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
                                  <strong style={{ color: '#ef4444', fontSize: '0.75rem' }}>
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
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default ValesGasto;