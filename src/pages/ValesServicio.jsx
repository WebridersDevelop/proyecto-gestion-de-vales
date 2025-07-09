import { useRef, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Form, Button, Card, Row, Col, Alert, Table, Badge, Spinner } from 'react-bootstrap';

function ValesServicio() {
  const { user, rol } = useAuth();
  const [servicio, setServicio] = useState('');
  const [valor, setValor] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nombreActual, setNombreActual] = useState('');
  const [valesUsuario, setValesUsuario] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaFiltro, setFechaFiltro] = useState(() => getHoyLocal());
  const servicioRef = useRef(null);
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
    if (!user?.uid) return;
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'vales_servicio'), snap => {
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
      setLoading(false);
    });
    return () => unsub();
  }, [user, mensaje]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Usuario actual:", user); // <-- Aquí sí funciona
    if (loading) return; // <--- Evita doble submit por si acaso

    setLoading(true); // <--- Activa loading lo antes posible
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
      let nombre = nombreActual;
      if (!nombre) {
        const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
        nombre = usuarioDoc.exists() && usuarioDoc.data().nombre ? usuarioDoc.data().nombre : 'Sin nombre';
      }

      await addDoc(collection(db, 'vales_servicio'), {
        servicio: servicio.trim(),
        valor: Number(valor),
        peluqueroUid: user.uid,
        peluqueroEmail: user.email,
        peluqueroNombre: nombre,
        estado: 'pendiente',
        aprobadoPor: '',
        fecha: Timestamp.now()
      });

      setServicio('');
      setValor('');
      if (servicioRef.current) servicioRef.current.blur();
      if (valorRef.current) valorRef.current.blur();

      setMensaje('¡Vale enviado correctamente!');
      // Mantén el botón deshabilitado mientras se muestra el mensaje
      setTimeout(() => {
        setMensaje('');
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error("Error al enviar el vale:", error);
      setMensaje('Error al enviar el vale');
      setTimeout(() => setMensaje(''), 2000);
      setLoading(false);
    }
  };

  const valesFiltrados = valesUsuario.filter(vale => {
    // Convierte ambas fechas a local y compara solo el año-mes-día
    const fechaValeLocal = new Date(vale.fecha.getTime() - vale.fecha.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    return fechaValeLocal === fechaFiltro;
  });

  if (rol !== 'admin' && rol !== 'anfitrion' && rol !== 'peluquero') {
    return <Alert variant="danger" className="mt-4 text-center">No autorizado</Alert>;
  }

  return (
    <div className="container">
      <Row className="justify-content-center mt-4">
        <Col xs={12} md={10} lg={8} xl={7}>
          <Card className="shadow-sm border-0" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title className="mb-4 text-center" style={{fontWeight: 700, letterSpacing: '-1px', fontSize: 24, color: "#2563eb"}}>
                <i className="bi bi-receipt me-2"></i>Vales de Servicio
              </Card.Title>
              {user && (
                <div style={{textAlign: 'center', marginBottom: 18, fontWeight: 500, color: "#444"}}>
                  <span style={{background: "#f3f4f6", borderRadius: 8, padding: "4px 14px"}}>
                    <i className="bi bi-person-circle me-1"></i>
                    {nombreActual}
                  </span>
                </div>
              )}
              {(rol === 'peluquero' || rol === 'admin' || rol === 'anfitrion') && (
                <Form onSubmit={handleSubmit} className="mb-4 p-3" style={{background: "#f9fafb", borderRadius: 12, boxShadow: "0 1px 8px #0001"}}>
                  <Row className="g-3">
                    <Col xs={12} md={7}>
                      <Form.Group controlId="servicio">
                        <Form.Label>Servicio</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Ej: Corte de cabello"
                          value={servicio}
                          onChange={e => setServicio(e.target.value)}
                          autoFocus
                          ref={servicioRef}
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Group controlId="valor">
                        <Form.Label>Valor</Form.Label>
                        <Form.Control
                          type="number"
                          placeholder="Ej: 10000"
                          value={valor}
                          onChange={e => setValor(e.target.value)}
                          min={1}
                          ref={valorRef}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <div className="d-grid mt-3">
                    <Button variant="primary" type="submit" disabled={loading}>
                      {loading ? <Spinner size="sm" animation="border" /> : <><i className="bi bi-plus-circle me-1"></i>Enviar Vale</>}
                    </Button>
                  </div>
                  {mensaje && (
                    <Alert className="mt-3 mb-0" variant={mensaje.startsWith('¡') ? 'success' : 'danger'}>
                      {mensaje}
                    </Alert>
                  )}
                </Form>
              )}
              {user && (
                <>
                  <hr />
                  <h5 className="mb-3" style={{fontWeight: 600, color: "#2563eb"}}>
                    <i className="bi bi-list-ul me-2"></i>Mis vales enviados
                  </h5>
                  <Form.Group className="mb-3" controlId="fechaFiltro">
                    <Form.Label>Filtrar por fecha</Form.Label>
                    <Form.Control
                      type="date"
                      value={fechaFiltro}
                      max={getHoyLocal()}
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
                        color: "#2563eb",
                        marginBottom: 10,
                        textAlign: "right"
                      }}
                    >
                      Acumulado del día (aprobados): ${valesFiltrados
                        .filter(v => v.estado === 'aprobado')
                        .reduce((acc, v) => acc + (Number(v.valor) || 0), 0)
                        .toLocaleString()}
                    </div>
                  )}
                  <div style={{overflowX: 'auto'}}>
                    <Table striped bordered hover size="sm" responsive="md" className="mb-0" style={{borderRadius: 12, overflow: 'hidden'}}>
                      <thead style={{background: "#f3f4f6"}}>
                        <tr>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Servicio</th>
                          <th>Valor</th>
                          <th>Estado</th>
                          <th>Aprobado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valesFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted">No tienes vales enviados para esta fecha.</td>
                          </tr>
                        ) : (
                          valesFiltrados.map(vale => (
                            <tr key={vale.id}>
                              <td>{vale.fecha.toLocaleDateString()}</td>
                              <td>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td>{vale.servicio}</td>
                              <td style={{fontWeight:600, color:'#2563eb'}}>${Number(vale.valor).toLocaleString()}</td>
                              <td>
                                <Badge bg={
                                  vale.estado === 'aprobado'
                                    ? 'success'
                                    : vale.estado === 'rechazado'
                                    ? 'danger'
                                    : 'warning'
                                } text={vale.estado === 'pendiente' ? 'dark' : undefined}>
                                  {vale.estado === 'aprobado'
                                    ? 'Aprobado'
                                    : vale.estado === 'rechazado'
                                    ? 'Rechazado'
                                    : 'Pendiente'}
                                </Badge>
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

function getHoyLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default ValesServicio;

/* 
  Reglas de seguridad de Firestore para la colección 'vales_servicio':

  allow read, write: if request.auth != null;

  - Permite a los usuarios autenticados leer y escribir en la colección.
  - Los usuarios no autenticados no podrán acceder a esta colección.
*/