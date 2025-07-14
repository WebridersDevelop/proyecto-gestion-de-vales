import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Table, Button, Alert, Spinner, Modal, Form, Badge, ButtonGroup } from 'react-bootstrap';
import { useMediaQuery } from 'react-responsive';
import React from 'react';

function AprobarValesServicio() {
  const { user, rol } = useAuth();
  const [valesServicio, setValesServicio] = useState([]);
  const [valesGasto, setValesGasto] = useState([]);
  const [valesPendientes, setValesPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [valeActual, setValeActual] = useState(null);
  const [accionModal, setAccionModal] = useState(''); // 'aprobar' o 'rechazar'
  const [observacion, setObservacion] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [local, setLocal] = useState('');
  const [dividirPorDos, setDividirPorDos] = useState('100');
  
  // Nuevos estados para filtros y funcionalidades mejoradas
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos', 'servicio', 'gasto'
  const [filtroValor, setFiltroValor] = useState('todos'); // 'todos', 'alto', 'medio', 'bajo'
  const [busqueda, setBusqueda] = useState('');
  const [valesSeleccionados, setValesSeleccionados] = useState([]);
  const [showMasivo, setShowMasivo] = useState(false);

  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vales_servicio'), snap => {
      const arr = [];
      snap.forEach(docu => {
        const data = docu.data();
        if (data.estado === 'pendiente') {
          arr.push({
            ...data,
            id: docu.id,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha),
            coleccion: 'vales_servicio',
            tipo: 'servicio'
          });
        }
      });
      setValesServicio(arr);
    });
    return () => unsub();
  }, [mensaje]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vales_gasto'), snap => {
      const arr = [];
      snap.forEach(docu => {
        const data = docu.data();
        if (data.estado === 'pendiente') {
          arr.push({
            ...data,
            id: docu.id,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha),
            coleccion: 'vales_gasto',
            tipo: 'gasto'
          });
        }
      });
      setValesGasto(arr);
    });
    return () => unsub();
  }, [mensaje]);

  useEffect(() => {
    const valesCombinados = [...valesServicio, ...valesGasto];
    let valesFiltrados = valesCombinados;

    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      valesFiltrados = valesFiltrados.filter(vale => vale.tipo === filtroTipo);
    }

    // Filtro por valor
    if (filtroValor !== 'todos') {
      valesFiltrados = valesFiltrados.filter(vale => {
        const valor = Number(vale.valor);
        switch (filtroValor) {
          case 'alto': return valor >= 100000;
          case 'medio': return valor >= 30000 && valor < 100000;
          case 'bajo': return valor < 30000;
          default: return true;
        }
      });
    }

    // Búsqueda por texto
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      valesFiltrados = valesFiltrados.filter(vale =>
        (vale.servicio || vale.concepto || '').toLowerCase().includes(termino) ||
        (vale.peluqueroNombre || vale.peluqueroEmail || '').toLowerCase().includes(termino)
      );
    }

    setValesPendientes(valesFiltrados.sort((a, b) => b.fecha - a.fecha));
    setLoading(false);
  }, [valesServicio, valesGasto, filtroTipo, filtroValor, busqueda]);

  const handleAccionVale = (vale, accion) => {
    setValeActual(vale);
    setAccionModal(accion);
    setObservacion('');
    setFormaPago('');
    setLocal('');
    setDividirPorDos('100'); // reset selector
    setShowModal(true);
  };

  const handleConfirmarAccion = async () => {
    if (!valeActual) return;
    if (!local) {
      setMensaje('Selecciona el local');
      return;
    }
    if (accionModal === 'aprobar' && !formaPago) {
      setMensaje('Selecciona la forma de pago');
      return;
    }
    try {
      await updateDoc(doc(db, valeActual.coleccion, valeActual.id), {
        estado: accionModal === 'aprobar' ? 'aprobado' : 'rechazado',
        aprobadoPor: user.email,
        observacion: observacion || '',
        local,
        ...(accionModal === 'aprobar' ? {
          formaPago,
          ...(valeActual.tipo === 'servicio' ? {
            dividirPorDos, // Guarda el porcentaje seleccionado
            comisionExtra: Number(valeActual.comisionExtra) || 0
          } : {})
        } : {})
      });
      setMensaje(accionModal === 'aprobar' ? '✅ Vale aprobado exitosamente' : '❌ Vale rechazado');
      setShowModal(false);
      setTimeout(() => setMensaje(''), 2000);
    } catch {
      setMensaje('❌ Error al actualizar el vale');
      setShowModal(false);
      setTimeout(() => setMensaje(''), 2000);
    }
  };

  // Función para seleccionar/deseleccionar vales
  const toggleSeleccionVale = (valeId) => {
    setValesSeleccionados(prev => 
      prev.includes(valeId) 
        ? prev.filter(id => id !== valeId)
        : [...prev, valeId]
    );
  };

  // Función para seleccionar todos los vales
  const toggleSeleccionTodos = () => {
    if (valesSeleccionados.length === valesPendientes.length) {
      setValesSeleccionados([]);
    } else {
      setValesSeleccionados(valesPendientes.map(vale => vale.id));
    }
  };

  // Función para aprobación masiva
  const handleAprobacionMasiva = async () => {
    if (valesSeleccionados.length === 0) return;
    if (!local || !formaPago) {
      setMensaje('Completa todos los campos requeridos');
      return;
    }

    try {
      const promesas = valesSeleccionados.map(valeId => {
        const vale = valesPendientes.find(v => v.id === valeId);
        return updateDoc(doc(db, vale.coleccion, valeId), {
          estado: 'aprobado',
          aprobadoPor: user.email,
          observacion: observacion || '',
          local,
          formaPago,
          ...(vale.tipo === 'servicio' ? {
            dividirPorDos,
            comisionExtra: Number(vale.comisionExtra) || 0
          } : {})
        });
      });

      await Promise.all(promesas);
      setMensaje(`✅ ${valesSeleccionados.length} vales aprobados exitosamente`);
      setShowMasivo(false);
      setValesSeleccionados([]);
      setTimeout(() => setMensaje(''), 2000);
    } catch {
      setMensaje('❌ Error en la aprobación masiva');
      setShowMasivo(false);
      setTimeout(() => setMensaje(''), 2000);
    }
  };

  // Calcular estadísticas
  const estadisticas = {
    total: valesPendientes.length,
    servicios: valesServicio.length,
    gastos: valesGasto.length,
    valorTotal: valesPendientes.reduce((sum, vale) => sum + Number(vale.valor), 0),
    valorServicios: valesServicio.reduce((sum, vale) => sum + Number(vale.valor), 0),
    valorGastos: valesGasto.reduce((sum, vale) => sum + Number(vale.valor), 0)
  };

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (rol !== 'admin' && rol !== 'anfitrion') {
    return <Alert variant="danger" className="mt-4 text-center">No tienes permisos para aprobar vales.</Alert>;
  }

  return (
    <>
      {/* Header moderno con gradiente */}
      <div style={{
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        borderRadius: '0 0 24px 24px',
        padding: '24px 16px',
        marginBottom: 24,
        color: 'white',
        boxShadow: '0 8px 24px rgba(139, 92, 246, 0.15)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ 
            margin: 0, 
            fontWeight: 700, 
            fontSize: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <i className="bi bi-shield-check" style={{ fontSize: '1.5rem' }}></i>
            Centro de Aprobaciones
          </h2>
          <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '1rem' }}>
            Gestiona y aprueba vales pendientes de forma eficiente
          </p>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <Row className="mb-4">
        <Col md={3} sm={6} className="mb-3">
          <Card style={{
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: 'white',
            height: '100%'
          }}>
            <Card.Body className="text-center">
              <i className="bi bi-clock-history" style={{ fontSize: '2rem', marginBottom: 8 }}></i>
              <h3 style={{ margin: 0, fontWeight: 700 }}>{estadisticas.total}</h3>
              <small style={{ opacity: 0.9 }}>Total Pendientes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card style={{
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            color: 'white',
            height: '100%'
          }}>
            <Card.Body className="text-center">
              <i className="bi bi-scissors" style={{ fontSize: '2rem', marginBottom: 8 }}></i>
              <h3 style={{ margin: 0, fontWeight: 700 }}>{estadisticas.servicios}</h3>
              <small style={{ opacity: 0.9 }}>Servicios</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card style={{
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            height: '100%'
          }}>
            <Card.Body className="text-center">
              <i className="bi bi-cash-coin" style={{ fontSize: '2rem', marginBottom: 8 }}></i>
              <h3 style={{ margin: 0, fontWeight: 700 }}>{estadisticas.gastos}</h3>
              <small style={{ opacity: 0.9 }}>Gastos</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card style={{
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            height: '100%'
          }}>
            <Card.Body className="text-center">
              <i className="bi bi-currency-dollar" style={{ fontSize: '2rem', marginBottom: 8 }}></i>
              <h3 style={{ margin: 0, fontWeight: 700 }}>
                ${estadisticas.valorTotal.toLocaleString()}
              </h3>
              <small style={{ opacity: 0.9 }}>Valor Total</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Controles de filtros y búsqueda */}
      <Card style={{ 
        border: 'none', 
        borderRadius: 16, 
        marginBottom: 24,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
      }}>
        <Card.Body>
          <Row className="align-items-end">
            <Col md={3} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-funnel me-2"></i>Tipo
              </Form.Label>
              <Form.Select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                style={{ borderRadius: 12 }}
              >
                <option value="todos">Todos los tipos</option>
                <option value="servicio">Solo Servicios</option>
                <option value="gasto">Solo Gastos</option>
              </Form.Select>
            </Col>
            <Col md={3} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-cash me-2"></i>Valor
              </Form.Label>
              <Form.Select
                value={filtroValor}
                onChange={(e) => setFiltroValor(e.target.value)}
                style={{ borderRadius: 12 }}
              >
                <option value="todos">Todos los valores</option>
                <option value="alto">Alto (+$100k)</option>
                <option value="medio">Medio ($30k-$100k)</option>
                <option value="bajo">Bajo (-$30k)</option>
              </Form.Select>
            </Col>
            <Col md={4} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-search me-2"></i>Búsqueda
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Buscar por servicio o peluquero..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ borderRadius: 12 }}
              />
            </Col>
            <Col md={2} className="mb-3">
              {valesSeleccionados.length > 0 && (
                <Button
                  variant="success"
                  onClick={() => setShowMasivo(true)}
                  style={{
                    borderRadius: 12,
                    fontWeight: 600,
                    width: '100%'
                  }}
                >
                  <i className="bi bi-check-all me-2"></i>
                  Masivo ({valesSeleccionados.length})
                </Button>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Mensaje de notificación mejorado */}
      {mensaje && (
        <Alert 
          variant={mensaje.includes('✅') ? 'success' : 'danger'}
          style={{
            borderRadius: 16,
            border: 'none',
            fontWeight: 600,
            marginBottom: 24
          }}
        >
          {mensaje}
        </Alert>
      )}

      {/* Tabla principal mejorada */}
      <Card style={{ 
        border: 'none', 
        borderRadius: 16,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
      }}>
        <Card.Header style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          border: 'none',
          borderRadius: '16px 16px 0 0',
          padding: '20px 24px'
        }}>
          <div className="d-flex justify-content-between align-items-center">
            <h5 style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
              <i className="bi bi-list-check me-2"></i>
              Vales Pendientes ({valesPendientes.length})
            </h5>
            {valesPendientes.length > 0 && (
              <Form.Check
                type="checkbox"
                label="Seleccionar todos"
                checked={valesSeleccionados.length === valesPendientes.length}
                onChange={toggleSeleccionTodos}
                style={{ fontWeight: 600 }}
              />
            )}
          </div>
        </Card.Header>
        <Card.Body style={{ padding: 0 }}>
          {valesPendientes.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <i className="bi bi-check-circle" style={{ fontSize: '3rem', marginBottom: 16 }}></i>
              <h5>¡Excelente trabajo!</h5>
              <p>No hay vales pendientes por aprobar</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table hover className="mb-0">
                <thead style={{
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0'
                }}>
                  <tr>
                    <th style={{ border: 'none', padding: '16px', fontWeight: 600 }}>
                      <Form.Check 
                        type="checkbox"
                        style={{ margin: 0 }}
                      />
                    </th>
                    <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Fecha</th>
                    <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Tipo</th>
                    <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Concepto</th>
                    <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Valor</th>
                    <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Profesional</th>
                    <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {valesPendientes.map((vale, index) => (
                    <tr key={vale.id} style={{
                      borderBottom: index === valesPendientes.length - 1 ? 'none' : '1px solid #f1f5f9',
                      transition: 'all 0.2s',
                    }}>
                      <td style={{ border: 'none', padding: '16px' }}>
                        <Form.Check
                          type="checkbox"
                          checked={valesSeleccionados.includes(vale.id)}
                          onChange={() => toggleSeleccionVale(vale.id)}
                        />
                      </td>
                      <td style={{ border: 'none', padding: '16px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {vale.fecha.toLocaleDateString()}
                          </div>
                          <small style={{ color: '#64748b' }}>
                            {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </small>
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '16px' }}>
                        <Badge 
                          bg={vale.tipo === 'servicio' ? 'primary' : 'danger'}
                          style={{
                            borderRadius: 12,
                            padding: '8px 12px',
                            fontWeight: 600
                          }}
                        >
                          <i className={`bi ${vale.tipo === 'servicio' ? 'bi-scissors' : 'bi-cash-coin'} me-1`}></i>
                          {vale.tipo === 'servicio' ? 'Servicio' : 'Gasto'}
                        </Badge>
                      </td>
                      <td style={{ border: 'none', padding: '16px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {vale.servicio || vale.concepto || '-'}
                        </div>
                        {vale.descripcion && (
                          <small style={{ color: '#64748b' }}>{vale.descripcion}</small>
                        )}
                      </td>
                      <td style={{ border: 'none', padding: '16px' }}>
                        <div style={{
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          color: vale.tipo === 'servicio' ? '#16a34a' : '#ef4444'
                        }}>
                          ${Number(vale.valor).toLocaleString()}
                        </div>
                        {vale.comisionExtra && Number(vale.comisionExtra) > 0 && (
                          <small style={{ color: '#059669' }}>
                            +${Number(vale.comisionExtra).toLocaleString()} extra
                          </small>
                        )}
                      </td>
                      <td style={{ border: 'none', padding: '16px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {vale.peluqueroNombre || vale.peluqueroEmail || '-'}
                        </div>
                        {vale.cliente && (
                          <small style={{ color: '#64748b' }}>Cliente: {vale.cliente}</small>
                        )}
                      </td>
                      <td style={{ border: 'none', padding: '16px' }}>
                        <ButtonGroup size="sm">
                          <Button
                            variant="outline-success"
                            onClick={() => handleAccionVale(vale, 'aprobar')}
                            style={{
                              borderRadius: '8px 0 0 8px',
                              fontWeight: 600,
                              border: '2px solid #16a34a',
                              color: '#16a34a'
                            }}
                          >
                            <i className="bi bi-check-lg"></i>
                          </Button>
                          <Button
                            variant="outline-danger"
                            onClick={() => handleAccionVale(vale, 'rechazar')}
                            style={{
                              borderRadius: '0 8px 8px 0',
                              fontWeight: 600,
                              border: '2px solid #ef4444',
                              borderLeft: 'none',
                              color: '#ef4444'
                            }}
                          >
                            <i className="bi bi-x-lg"></i>
                          </Button>
                        </ButtonGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal de aprobación masiva */}
      <Modal show={showMasivo} onHide={() => setShowMasivo(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '2px solid #f1f5f9' }}>
          <Modal.Title style={{ color: '#1e293b', fontWeight: 700 }}>
            <i className="bi bi-check-all me-2" style={{ color: '#16a34a' }}></i>
            Aprobación Masiva
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" style={{ borderRadius: 12 }}>
            <i className="bi bi-info-circle me-2"></i>
            Se aprobarán <strong>{valesSeleccionados.length} vales</strong> con la configuración seleccionada.
          </Alert>
          
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Local <span style={{color:'red'}}>*</span></Form.Label>
            <Form.Select
              value={local}
              onChange={e => setLocal(e.target.value)}
              style={{ borderRadius: 12 }}
              required
            >
              <option value="">Selecciona un local</option>
              <option value="La Tirana">La Tirana</option>
              <option value="Salvador Allende">Salvador Allende</option>
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Forma de Pago <span style={{color:'red'}}>*</span></Form.Label>
            <Form.Select
              value={formaPago}
              onChange={e => setFormaPago(e.target.value)}
              style={{ borderRadius: 12 }}
              required
            >
              <option value="">Selecciona forma de pago</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Observación (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Agrega una observación..."
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              style={{ borderRadius: 12 }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '2px solid #f1f5f9' }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowMasivo(false)}
            style={{ borderRadius: 12 }}
          >
            Cancelar
          </Button>
          <Button 
            variant="success" 
            onClick={handleAprobacionMasiva}
            style={{ borderRadius: 12, fontWeight: 600 }}
          >
            <i className="bi bi-check-all me-2"></i>
            Aprobar {valesSeleccionados.length} Vales
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal individual mejorado */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '2px solid #f1f5f9' }}>
          <Modal.Title style={{ 
            color: accionModal === 'aprobar' ? '#16a34a' : '#ef4444',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <i className={`bi ${accionModal === 'aprobar' ? 'bi-check-circle' : 'bi-x-circle'}`}></i>
            {accionModal === 'aprobar' ? 'Aprobar Vale' : 'Rechazar Vale'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {valeActual && (
            <Alert 
              variant={accionModal === 'aprobar' ? 'success' : 'warning'} 
              style={{ borderRadius: 12, marginBottom: 20 }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                <i className={`bi ${valeActual.tipo === 'servicio' ? 'bi-scissors' : 'bi-cash-coin'} me-2`}></i>
                {valeActual.tipo === 'servicio' ? 'Vale de Servicio' : 'Vale de Gasto'}
              </div>
              <div><strong>Concepto:</strong> {valeActual.servicio || valeActual.concepto}</div>
              <div><strong>Valor:</strong> ${Number(valeActual.valor).toLocaleString()}</div>
              <div><strong>Profesional:</strong> {valeActual.peluqueroNombre || valeActual.peluqueroEmail}</div>
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Local <span style={{color:'red'}}>*</span></Form.Label>
            <Form.Select
              value={local}
              onChange={e => setLocal(e.target.value)}
              style={{ borderRadius: 12 }}
              required
            >
              <option value="">Selecciona un local</option>
              <option value="La Tirana">La Tirana</option>
              <option value="Salvador Allende">Salvador Allende</option>
            </Form.Select>
          </Form.Group>

          {accionModal === 'aprobar' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontWeight: 600 }}>Forma de Pago <span style={{color:'red'}}>*</span></Form.Label>
                <Form.Select
                  value={formaPago}
                  onChange={e => setFormaPago(e.target.value)}
                  style={{ borderRadius: 12 }}
                  required
                >
                  <option value="">Selecciona una opción</option>
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="debito">💳 Débito</option>
                  <option value="transferencia">🏦 Transferencia</option>
                </Form.Select>
              </Form.Group>
              
              {valeActual && valeActual.tipo === 'servicio' && (
                <Card style={{ 
                  border: '2px solid #e5e7eb', 
                  borderRadius: 12, 
                  background: '#f8fafc',
                  marginBottom: 16
                }}>
                  <Card.Body>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                        <i className="bi bi-pie-chart me-2"></i>
                        Distribución del Monto
                      </Form.Label>
                      <Form.Select
                        value={dividirPorDos}
                        onChange={e => setDividirPorDos(e.target.value)}
                        style={{ borderRadius: 12 }}
                      >
                        <option value="100">🎯 No dividir (100% para el profesional)</option>
                        <option value="50">⚖️ Dividir 50/50 (50% profesional, 50% empresa)</option>
                        <option value="45">📊 Dividir 45/55 (45% profesional, 55% empresa)</option>
                      </Form.Select>
                    </Form.Group>
                    
                    {dividirPorDos !== '100' && (
                      <Alert variant="info" style={{ borderRadius: 12, margin: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          💰 Distribución del vale:
                        </div>
                        <div>
                          👤 Profesional: <strong>{dividirPorDos}%</strong> = ${((Number(valeActual.valor) * Number(dividirPorDos)) / 100).toLocaleString()}
                        </div>
                        <div>
                          🏢 Empresa: <strong>{100 - Number(dividirPorDos)}%</strong> = ${((Number(valeActual.valor) * (100 - Number(dividirPorDos))) / 100).toLocaleString()}
                        </div>
                      </Alert>
                    )}
                  </Card.Body>
                </Card>
              )}
            </>
          )}

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>
              Observación {accionModal === 'rechazar' ? <span style={{color:'red'}}>*</span> : '(opcional)'}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder={accionModal === 'aprobar' 
                ? "Agrega una observación opcional..." 
                : "Explica el motivo del rechazo..."
              }
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              style={{ borderRadius: 12 }}
              required={accionModal === 'rechazar'}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '2px solid #f1f5f9' }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowModal(false)}
            style={{ borderRadius: 12 }}
          >
            Cancelar
          </Button>
          <Button 
            variant={accionModal === 'aprobar' ? 'success' : 'danger'}
            onClick={handleConfirmarAccion}
            style={{ borderRadius: 12, fontWeight: 600 }}
          >
            <i className={`bi ${accionModal === 'aprobar' ? 'bi-check-lg' : 'bi-x-lg'} me-2`}></i>
            {accionModal === 'aprobar' ? 'Aprobar Vale' : 'Rechazar Vale'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default AprobarValesServicio;
