import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Form, Button, Card, Row, Col, Alert, Table } from 'react-bootstrap';

function ValesServicio() {
  const { user, rol } = useAuth();
  const [servicio, setServicio] = useState('');
  const [valor, setValor] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nombreActual, setNombreActual] = useState('');
  const [valesUsuario, setValesUsuario] = useState([]);
  const [formaPago, setFormaPago] = useState('');

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
    const fetchVales = async () => {
      if (user?.uid) {
        const snap = await getDocs(collection(db, 'vales_servicio'));
        const vales = [];
        snap.forEach(docu => {
          const data = docu.data();
          if (data.peluqueroUid === user.uid) {
            vales.push({
              ...data,
              id: docu.id,
              fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
            });
          }
        });
        vales.sort((a, b) => b.fecha - a.fecha);
        setValesUsuario(vales);
      }
    };
    fetchVales();
  }, [user, mensaje]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!servicio || !valor || !formaPago) {
      setMensaje('Completa todos los campos');
      return;
    }

    try {
      let nombre = nombreActual;
      if (!nombre) {
        const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
        nombre = usuarioDoc.exists() && usuarioDoc.data().nombre ? usuarioDoc.data().nombre : 'Sin nombre';
      }

      await addDoc(collection(db, 'vales_servicio'), {
        servicio,
        valor: Number(valor),
        peluqueroUid: user.uid,
        peluqueroEmail: user.email,
        peluqueroNombre: nombre,
        formaPago,
        estado: 'pendiente',
        aprobadoPor: '',
        fecha: Timestamp.now()
      });

      setServicio('');
      setValor('');
      setFormaPago('');
      setMensaje('¡Vale enviado correctamente!');
      setTimeout(() => setMensaje(''), 2000);
    } catch (error) {
      setMensaje('Error al enviar el vale');
      setTimeout(() => setMensaje(''), 2000);
    }
  };

  return (
    <Row className="justify-content-center mt-4">
      <Col xs={12} md={10} lg={8} xl={7}>
        <Card className="shadow-sm">
          <Card.Body>
            <Card.Title className="mb-4 text-center">Vales de Servicio</Card.Title>
            {user && (
              <div style={{textAlign: 'center', marginBottom: 10}}>
                <b>Usuario actual:</b> {nombreActual}
              </div>
            )}
            {(rol === 'peluquero' || rol === 'admin') && (
              <Form onSubmit={handleSubmit} className="mb-4">
                <Form.Group className="mb-3" controlId="servicio">
                  <Form.Label>Servicio</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ej: Corte de cabello"
                    value={servicio}
                    onChange={e => setServicio(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="valor">
                  <Form.Label>Valor</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="Ej: 10000"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="formaPago">
                  <Form.Label>Forma de Pago</Form.Label>
                  <Form.Select value={formaPago} onChange={e => setFormaPago(e.target.value)} required>
                    <option value="">Selecciona una opción</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="debito">Débito</option>
                    <option value="transferencia">Transferencia</option>
                  </Form.Select>
                </Form.Group>
                <div className="d-grid">
                  <Button variant="primary" type="submit">
                    Enviar Vale
                  </Button>
                </div>
                {mensaje && <Alert className="mt-3" variant={mensaje.startsWith('¡') ? 'success' : 'danger'}>{mensaje}</Alert>}
              </Form>
            )}
            {user && (
              <>
                <hr />
                <h5 className="mb-3">Mis vales enviados</h5>
                <div style={{overflowX: 'auto'}}>
                  <Table striped bordered hover size="sm" responsive="sm">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Servicio</th>
                        <th>Forma de Pago</th>
                        <th>Valor</th>
                        <th>Estado</th>
                        <th>Aprobado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valesUsuario.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center">No tienes vales enviados.</td>
                        </tr>
                      ) : (
                        valesUsuario.map(vale => (
                          <tr key={vale.id}>
                            <td>{vale.fecha.toLocaleDateString()}</td>
                            <td>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>{vale.servicio}</td>
                            <td>{vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</td>
                            <td>${Number(vale.valor).toLocaleString()}</td>
                            <td>{vale.estado || 'pendiente'}</td>
                            <td>{vale.aprobadoPor || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default ValesServicio;