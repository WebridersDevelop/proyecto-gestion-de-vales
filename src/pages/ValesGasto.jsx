import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Form, Button, Card, Row, Col, Alert, Table } from 'react-bootstrap';

function ValesGasto() {
  const { user, rol } = useAuth();
  const [concepto, setConcepto] = useState('');
  const [valor, setValor] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nombreActual, setNombreActual] = useState('');
  const [valesUsuario, setValesUsuario] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaFiltro, setFechaFiltro] = useState(() => {
    const hoy = new Date();
    return hoy.toISOString().slice(0, 10); // formato YYYY-MM-DD
  });

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
        const snap = await getDocs(collection(db, 'vales_gasto'));
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
    setMensaje('');
    if (!concepto.trim() || !valor) {
      setMensaje('Completa todos los campos');
      return;
    }
    if (isNaN(valor) || Number(valor) <= 0) {
      setMensaje('El valor debe ser un número positivo');
      return;
    }
    setLoading(true);
    try {
      let nombre = nombreActual;
      if (!nombre) {
        const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
        nombre = usuarioDoc.exists() && usuarioDoc.data().nombre ? usuarioDoc.data().nombre : 'Sin nombre';
      }

      await addDoc(collection(db, 'vales_gasto'), {
        concepto: concepto.trim(),
        valor: Number(valor),
        peluqueroUid: user.uid,
        peluqueroEmail: user.email,
        peluqueroNombre: nombre,
        estado: 'pendiente',
        aprobadoPor: '',
        fecha: Timestamp.now()
      });

      setConcepto('');
      setValor('');
      setMensaje('¡Vale de gasto enviado correctamente!');
      setTimeout(() => setMensaje(''), 2000);
    } catch (error) {
      setMensaje('Error al enviar el vale');
      setTimeout(() => setMensaje(''), 2000);
    }
    setLoading(false);
  };

  // Filtro por fecha seleccionada
  const valesFiltrados = valesUsuario.filter(vale => {
    const fechaVale = vale.fecha.toISOString().slice(0, 10);
    return fechaVale === fechaFiltro;
  });

  if (rol !== 'admin' && rol !== 'anfitrion' && rol !== 'peluquero') {
    return <Alert variant="danger" className="mt-4 text-center">No autorizado</Alert>;
  }

  return (
    <div className="container">
      <Row className="justify-content-center mt-4">
        <Col xs={12} md={12} lg={11} xl={10}>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="mb-4 text-center" style={{fontWeight: 600, letterSpacing: '-1px'}}>Vales de Gasto</Card.Title>
              {user && (
                <div style={{textAlign: 'center', marginBottom: 10}}>
                  <b>Usuario actual:</b> {nombreActual}
                </div>
              )}
              {(rol === 'peluquero' || rol === 'admin' || rol === 'anfitrion') && (
                <Form onSubmit={handleSubmit} className="mb-4">
                  <Form.Group className="mb-3" controlId="concepto">
                    <Form.Label>Concepto</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Ej: Compra de insumos"
                      value={concepto}
                      onChange={e => setConcepto(e.target.value)}
                      autoFocus
                    />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="valor">
                    <Form.Label>Valor</Form.Label>
                    <Form.Control
                      type="number"
                      placeholder="Ej: 5000"
                      value={valor}
                      onChange={e => setValor(e.target.value)}
                      min={1}
                    />
                  </Form.Group>
                  <div className="d-grid">
                    <Button variant="danger" type="submit" disabled={loading}>
                      {loading ? "Enviando..." : "Enviar Vale de Gasto"}
                    </Button>
                  </div>
                  {mensaje && (
                    <Alert className="mt-3" variant={mensaje.startsWith('¡') ? 'success' : 'danger'}>
                      {mensaje}
                    </Alert>
                  )}
                </Form>
              )}
              {user && (
                <>
                  <hr />
                  <h5 className="mb-3">Mis vales de gasto enviados</h5>
                  {/* Selector de fecha */}
                  <Form.Group className="mb-3" controlId="fechaFiltro">
                    <Form.Label>Filtrar por fecha</Form.Label>
                    <Form.Control
                      type="date"
                      value={fechaFiltro}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={e => setFechaFiltro(e.target.value)}
                      style={{maxWidth: 200}}
                    />
                  </Form.Group>
                  {/* Acumulado del día */}
                  {valesFiltrados.length > 0 && (
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 17,
                        color: "#ef4444",
                        marginBottom: 10,
                        textAlign: "right"
                      }}
                    >
                      Acumulado del día: ${valesFiltrados
                        .filter(v => v.estado === 'aprobado')
                        .reduce((acc, v) => acc + (Number(v.valor) || 0), 0)
                        .toLocaleString()}
                    </div>
                  )}
                  <div style={{overflowX: 'auto'}}>
                    <Table striped bordered hover size="sm" responsive="md" className="mb-0">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Concepto</th>
                          <th>Valor</th>
                          <th>Estado</th>
                          <th>Aprobado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valesFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center">No tienes vales de gasto enviados para esta fecha.</td>
                          </tr>
                        ) : (
                          valesFiltrados.map(vale => (
                            <tr key={vale.id}>
                              <td>{vale.fecha.toLocaleDateString()}</td>
                              <td>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td>{vale.concepto}</td>
                              <td>${Number(vale.valor).toLocaleString()}</td>
                              <td>
                                <span className={`badge ${
                                  vale.estado === 'aprobado'
                                    ? 'bg-success'
                                    : vale.estado === 'rechazado'
                                    ? 'bg-danger'
                                    : 'bg-warning text-dark'
                                }`}>
                                  {vale.estado === 'aprobado'
                                    ? 'Aprobado'
                                    : vale.estado === 'rechazado'
                                    ? 'Rechazado'
                                    : 'Pendiente'}
                                </span>
                              </td>
                              <td>
                                {vale.estado === 'aprobado' && vale.aprobadoPor ? (
                                  <span style={{ color: '#16a34a', fontWeight: 600 }}>
                                    <i className="bi bi-check-circle" style={{marginRight: 4}}></i>
                                    {vale.aprobadoPor}
                                  </span>
                                ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
                                  <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                    <i className="bi bi-x-circle" style={{marginRight: 4}}></i>
                                    {vale.aprobadoPor}
                                  </span>
                                ) : (
                                  <span className="text-secondary">-</span>
                                )}
                              </td>
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
    </div>
  );
}

export default ValesGasto;