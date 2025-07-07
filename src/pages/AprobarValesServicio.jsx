import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Card, Row, Col, Table, Button, Alert, Spinner, Modal, Form } from 'react-bootstrap';

function AprobarValesServicio() {
  const { user, rol } = useAuth();
  const [valesPendientes, setValesPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [accionVale, setAccionVale] = useState(null); // {vale, accion: 'aprobar'|'rechazar'}
  const [observacion, setObservacion] = useState('');

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

  // Modal para aprobar/rechazar con observación
  const handleAccionVale = (vale, accion) => {
    setAccionVale({ vale, accion });
    setObservacion('');
    setShowModal(true);
  };

  const handleConfirmarAccion = async () => {
    if (!accionVale) return;
    const { vale, accion } = accionVale;
    try {
      await updateDoc(doc(db, vale.coleccion, vale.id), {
        estado: accion === 'aprobar' ? 'aprobado' : 'rechazado',
        aprobadoPor: user.email,
        observacion: observacion || ''
      });
      setMensaje(accion === 'aprobar' ? 'Vale aprobado' : 'Vale rechazado');
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
      {/* Modal para observación */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {accionVale?.accion === 'aprobar' ? 'Aprobar Vale' : 'Rechazar Vale'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
            variant={accionVale?.accion === 'aprobar' ? 'success' : 'danger'}
            onClick={handleConfirmarAccion}
          >
            {accionVale?.accion === 'aprobar' ? <><i className="bi bi-check-circle me-1"></i>Aprobar</> : <><i className="bi bi-x-circle me-1"></i>Rechazar</>}
          </Button>
        </Modal.Footer>
      </Modal>

      <Row className="justify-content-center mt-4">
        <Col xs={12} md={11} lg={10}>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="mb-4 text-center" style={{fontWeight: 600, letterSpacing: '-1px'}}>Aprobar Vales de Servicio y Gasto</Card.Title>
              {mensaje && <Alert variant="info">{mensaje}</Alert>}
              <div style={{overflowX: 'auto'}}>
                <Table striped bordered hover size="sm" responsive="sm" className="mb-0">
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
                          <Button
                            size="sm"
                            variant="success"
                            className="me-2"
                            style={{background: '#16a34a', borderColor: '#16a34a'}}
                            onClick={() => handleAccionVale(vale, 'aprobar')}
                          >
                            <i className="bi bi-check-circle me-1"></i>
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            style={{background: '#ef4444', borderColor: '#ef4444'}}
                            onClick={() => handleAccionVale(vale, 'rechazar')}
                          >
                            <i className="bi bi-x-circle me-1"></i>
                            Rechazar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default AprobarValesServicio;