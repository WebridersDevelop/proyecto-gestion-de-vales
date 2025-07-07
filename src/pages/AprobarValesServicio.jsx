import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Table, Button, Alert, Spinner, Modal, Form } from 'react-bootstrap';
import { useMediaQuery } from 'react-responsive';
import React from 'react';

function AprobarValesServicio() {
  const { user, rol } = useAuth();
  const [valesPendientes, setValesPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [valeActual, setValeActual] = useState(null);
  const [accionModal, setAccionModal] = useState(''); // 'aprobar' o 'rechazar'
  const [observacion, setObservacion] = useState('');
  const [formaPago, setFormaPago] = useState('');

  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    const fetchVales = async () => {
      setLoading(true);
      const snaps = await Promise.all([
        getDocs(collection(db, 'vales_servicio')),
        getDocs(collection(db, 'vales_gasto'))
      ]);
      const vales = [];
      snaps.forEach((snap, idx) => {
        const tipo = idx === 0 ? 'servicio' : 'gasto';
        snap.forEach(docu => {
          const data = docu.data();
          if (data.estado === 'pendiente') {
            vales.push({
              ...data,
              id: docu.id,
              fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha),
              coleccion: idx === 0 ? 'vales_servicio' : 'vales_gasto',
              tipo
            });
          }
        });
      });
      setValesPendientes(vales);
      setLoading(false);
    };
    fetchVales();
  }, [mensaje]);

  const handleAccionVale = (vale, accion) => {
    setValeActual(vale);
    setAccionModal(accion);
    setObservacion('');
    setFormaPago('');
    setShowModal(true);
  };

  const handleConfirmarAccion = async () => {
    if (!valeActual) return;
    if (accionModal === 'aprobar' && !formaPago) {
      setMensaje('Selecciona la forma de pago');
      return;
    }
    try {
      await updateDoc(doc(db, valeActual.coleccion, valeActual.id), {
        estado: accionModal === 'aprobar' ? 'aprobado' : 'rechazado',
        aprobadoPor: user.email,
        observacion: observacion || '',
        ...(accionModal === 'aprobar' ? { formaPago } : {})
      });
      setMensaje(accionModal === 'aprobar' ? 'Vale aprobado' : 'Vale rechazado');
      setShowModal(false);
      setTimeout(() => setMensaje(''), 1500);
    } catch {
      setMensaje('Error al actualizar');
      setShowModal(false);
      setTimeout(() => setMensaje(''), 1500);
    }
  };

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (rol !== 'admin' && rol !== 'anfitrion') {
    return <Alert variant="danger" className="mt-4 text-center">No tienes permisos para aprobar vales.</Alert>;
  }

  return (
    <>
      {/* Modal para observación y forma de pago */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {accionModal === 'aprobar' ? 'Aprobar Vale' : 'Rechazar Vale'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {accionModal === 'aprobar' && (
            <Form.Group className="mb-3">
              <Form.Label>Forma de Pago <span style={{color:'red'}}>*</span></Form.Label>
              <Form.Select
                value={formaPago}
                onChange={e => setFormaPago(e.target.value)}
                required
              >
                <option value="">Selecciona una opción</option>
                <option value="efectivo">Efectivo</option>
                <option value="debito">Débito</option>
                <option value="transferencia">Transferencia</option>
              </Form.Select>
            </Form.Group>
          )}
          <Form.Group>
            <Form.Label>Observación (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Puedes agregar una observación si lo deseas"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancelar
          </Button>
          <Button
            variant={accionModal === 'aprobar' ? 'success' : 'danger'}
            onClick={handleConfirmarAccion}
          >
            {accionModal === 'aprobar' ? <><i className="bi bi-check-circle me-1"></i>Aprobar</> : <><i className="bi bi-x-circle me-1"></i>Rechazar</>}
          </Button>
        </Modal.Footer>
      </Modal>

      <Row className="justify-content-center mt-4">
        <Col xs={12} md={11} lg={10}>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="mb-4 text-center" style={{fontWeight: 600, letterSpacing: '-1px'}}>Aprobar Vales de Servicio y Gasto</Card.Title>
              {mensaje && <Alert variant="info">{mensaje}</Alert>}
              {isMobile ? (
                <div>
                  {valesPendientes.length === 0 ? (
                    <Alert variant="info" className="text-center">No hay vales pendientes.</Alert>
                  ) : (
                    valesPendientes.map(vale => (
                      <div className={`vale-card ${vale.tipo === 'gasto' ? 'egreso' : ''}`} key={vale.id} style={{marginBottom: 16}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <span style={{fontWeight: 600}}>{vale.fecha.toLocaleDateString()} {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className={`badge ${vale.tipo === 'servicio' ? 'bg-primary' : 'bg-danger'}`}>
                            {vale.tipo === 'servicio' ? 'Servicio' : 'Gasto'}
                          </span>
                        </div>
                        <div><b>Servicio/Concepto:</b> {vale.servicio || vale.concepto || '-'}</div>
                        <div><b>Valor:</b> <span style={{fontWeight:600, color: vale.tipo === 'servicio' ? '#16a34a' : '#ef4444'}}>${Number(vale.valor).toLocaleString()}</span></div>
                        <div><b>Peluquero:</b> {vale.peluqueroNombre || vale.peluqueroEmail || '-'}</div>
                        <div><b>Forma de Pago:</b> {vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</div>
                        <div><b>Observación:</b> {vale.observacion || <span className="text-muted">-</span>}</div>
                        <div className="d-flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="success"
                            style={{background: '#16a34a', borderColor: '#16a34a'}}
                            onClick={() => handleAccionVale(vale, 'aprobar')}
                            className="flex-fill"
                          >
                            <i className="bi bi-check-circle me-1"></i>Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            style={{background: '#ef4444', borderColor: '#ef4444'}}
                            onClick={() => handleAccionVale(vale, 'rechazar')}
                            className="flex-fill"
                          >
                            <i className="bi bi-x-circle me-1"></i>Rechazar
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div
                  style={{
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    marginBottom: 12,
                    boxShadow: '0 2px 8px #0001'
                  }}
                >
                  <Table striped bordered hover size="sm" responsive="xs" className="mb-0" style={{ minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Tipo</th>
                        <th>Servicio/Concepto</th>
                        <th>Valor</th>
                        <th>Peluquero</th>
                        <th>Forma de Pago</th>
                        <th>Observación</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valesPendientes.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center">No hay vales pendientes.</td>
                        </tr>
                      ) : valesPendientes.map(vale => (
                        <tr key={vale.id}>
                          <td>{vale.fecha.toLocaleDateString()}</td>
                          <td>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span className={`badge ${vale.tipo === 'servicio' ? 'bg-primary' : 'bg-danger'}`}>
                              {vale.tipo === 'servicio' ? 'Servicio' : 'Gasto'}
                            </span>
                          </td>
                          <td>{vale.servicio || vale.concepto || '-'}</td>
                          <td style={{fontWeight:600, color: vale.tipo === 'servicio' ? '#16a34a' : '#ef4444'}}>
                            ${Number(vale.valor).toLocaleString()}
                          </td>
                          <td>{vale.peluqueroNombre || vale.peluqueroEmail || '-'}</td>
                          <td>{vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</td>
                          <td>
                            {vale.observacion
                              ? <span className="text-secondary">{vale.observacion}</span>
                              : <span className="text-muted">-</span>
                            }
                          </td>
                          <td>
                            <div className="d-flex flex-column flex-md-row gap-2">
                              <Button
                                size="sm"
                                variant="success"
                                style={{background: '#16a34a', borderColor: '#16a34a', minWidth: 90}}
                                onClick={() => handleAccionVale(vale, 'aprobar')}
                              >
                                <i className="bi bi-check-circle me-1"></i>
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                style={{background: '#ef4444', borderColor: '#ef4444', minWidth: 90}}
                                onClick={() => handleAccionVale(vale, 'rechazar')}
                              >
                                <i className="bi bi-x-circle me-1"></i>
                                Rechazar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default AprobarValesServicio;