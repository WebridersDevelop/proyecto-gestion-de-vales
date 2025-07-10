import { useState, useEffect, useRef } from 'react';
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
  const [fechaFiltro, setFechaFiltro] = useState(() => getHoyLocal());
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
    if (!user?.uid) return;
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'vales_gasto'), snap => {
      const vales = [];
      snap.forEach(docu => {
        const data = docu.data();
        // Mostrar todos los vales si es admin, solo los propios si no
        if (
          rol === 'admin' ||
          rol === 'anfitrion'
        ) {
          vales.push({
            ...data,
            id: docu.id,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
          });
        } else if (data.peluqueroUid === user.uid) {
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
  }, [user, mensaje, rol]);

  const handleSubmit = async (e) => {
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
  };

  // Filtro por fecha seleccionada
  const valesFiltrados = valesUsuario.filter(vale => {
    if (!vale.fecha || !(vale.fecha instanceof Date)) return false;
    const yyyy = vale.fecha.getFullYear();
    const mm = String(vale.fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(vale.fecha.getDate()).padStart(2, '0');
    const fechaVale = `${yyyy}-${mm}-${dd}`;
    return fechaVale === fechaFiltro;
  });

  // Cambia aquí la lógica de acceso para los nuevos roles
  if (
    !['admin', 'anfitrion', 'barbero', 'estilista', 'estetica'].includes(rol)
  ) {
    return <Alert variant="danger" className="mt-4 text-center">No autorizado</Alert>;
  }

  return (
    <div className="container">
      <Row className="justify-content-center mt-4">
        <Col xs={12} md={10} lg={8} xl={7}>
          <Card className="shadow-sm border-0" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title className="mb-4 text-center" style={{fontWeight: 700, letterSpacing: '-1px', fontSize: 24, color: "#ef4444"}}>
                <i className="bi bi-cash-stack me-2"></i>Vales de Gasto
              </Card.Title>
              {user && (
                <div style={{textAlign: 'center', marginBottom: 18, fontWeight: 500, color: "#444"}}>
                  <span style={{background: "#f3f4f6", borderRadius: 8, padding: "4px 14px"}}>
                    <i className="bi bi-person-circle me-1"></i>
                    {nombreActual}
                  </span>
                </div>
              )}
              {(['barbero', 'estilista', 'estetica', 'admin', 'anfitrion'].includes(rol)) && (
                <Form onSubmit={handleSubmit} className="mb-4 p-3" style={{background: "#f9fafb", borderRadius: 12, boxShadow: "0 1px 8px #0001"}}>
                  <Row className="g-3">
                    <Col xs={12} md={7}>
                      <Form.Group controlId="concepto">
                        <Form.Label>Concepto</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Ej: Compra de insumos"
                          value={concepto}
                          onChange={e => setConcepto(e.target.value)}
                          autoFocus
                          ref={conceptoRef}
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Group controlId="valor">
                        <Form.Label>Valor</Form.Label>
                        <Form.Control
                          type="number"
                          placeholder="Ej: 5000"
                          value={valor}
                          onChange={e => setValor(e.target.value)}
                          min={1}
                          ref={valorRef}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <div className="d-grid mt-3">
                    <Button variant="danger" type="submit" disabled={loading}>
                      {loading ? <Spinner size="sm" animation="border" /> : <><i className="bi bi-plus-circle me-1"></i>Enviar Vale de Gasto</>}
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
                  <h5 className="mb-3" style={{fontWeight: 600, color: "#ef4444"}}>
                    <i className="bi bi-list-ul me-2"></i>Mis vales de gasto enviados
                  </h5>
                  {/* Selector de fecha */}
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
                        color: "#ef4444",
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
                  {/* Tabla para pantallas medianas y grandes */}
                  <div className="d-none d-md-block" style={{overflowX: 'auto'}}>
                    <Table striped bordered hover size="sm" responsive="md" className="mb-0" style={{borderRadius: 12, overflow: 'hidden'}}>
                      <thead style={{background: "#f3f4f6"}}>
                        <tr>
                          <th>Código</th>
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
                            <td colSpan={7} className="text-center text-muted">No tienes vales de gasto enviados para esta fecha.</td>
                          </tr>
                        ) : (
                          valesFiltrados.map(vale => (
                            <tr
                              key={vale.id}
                              style={{
                                borderLeft: `6px solid ${
                                  vale.estado === 'aprobado'
                                    ? '#22c55e'
                                    : vale.estado === 'rechazado'
                                    ? '#ef4444'
                                    : '#f59e0b'
                                }`,
                                background: vale.estado === 'rechazado'
                                  ? '#fef2f2'
                                  : vale.estado === 'aprobado'
                                  ? '#f0fdf4'
                                  : '#fffbeb',
                                fontWeight: 500,
                                fontSize: 15,
                              }}
                            >
                              <td style={{ fontWeight: 700, color: '#ef4444', background: '#f3f4f6' }}>
                                {vale.codigo || 'G-000'}
                              </td>
                              <td>{vale.fecha.toLocaleDateString()}</td>
                              <td>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td style={{ fontWeight: 600, color: '#374151' }}>{vale.concepto}</td>
                              <td style={{ fontWeight: 700, color: '#ef4444' }}>
                                ${Number(vale.valor).toLocaleString()}
                              </td>
                              <td>
                                <Badge
                                  bg={
                                    vale.estado === 'aprobado'
                                      ? 'success'
                                      : vale.estado === 'rechazado'
                                      ? 'danger'
                                      : 'warning'
                                  }
                                  text={vale.estado === 'pendiente' ? 'dark' : undefined}
                                  style={{ fontSize: '0.8rem' }}
                                >
                                  {vale.estado === 'aprobado'
                                    ? 'OK'
                                    : vale.estado === 'rechazado'
                                    ? 'NO'
                                    : 'Pend.'}
                                </Badge>
                              </td>
                              <td>
                                {vale.estado === 'aprobado' && vale.aprobadoPor ? (
                                  <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                    <i className="bi bi-check-circle" style={{ marginRight: 4 }}></i>
                                    {vale.aprobadoPor}
                                  </span>
                                ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
                                  <span style={{ color: '#ef4444', fontWeight: 700 }}>
                                    <i className="bi bi-x-circle" style={{ marginRight: 4 }}></i>
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

                  {/* Vista optimizada para móviles - Lista compacta */}
                  <div className="d-block d-md-none">
                    {valesFiltrados.length === 0 ? (
                      <div className="text-center text-muted py-4">
                        <i className="bi bi-inbox" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                        <p className="mb-0" style={{ fontSize: '1.1rem' }}>
                          No tienes vales de gasto enviados para esta fecha.
                        </p>
                      </div>
                    ) : (
                      valesFiltrados.map(vale => (
                        <div
                          key={vale.id}
                          className="mb-3"
                          style={{
                            borderRadius: 12,
                            overflow: 'hidden',
                            boxShadow: "0 1px 8px #0001",
                            background: vale.estado === 'rechazado'
                              ? '#fef2f2'
                              : vale.estado === 'aprobado'
                                ? '#f0fdf4'
                                : '#fffbeb',
                            borderLeft: `6px solid ${
                              vale.estado === 'aprobado'
                                ? '#22c55e'
                                : vale.estado === 'rechazado'
                                ? '#ef4444'
                                : '#f59e0b'
                            }`
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center" style={{ padding: '12px 16px', background: '#f3f4f6' }}>
                            <div>
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Código:</span>
                              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '1.1rem', marginLeft: 6 }}>
                                {vale.codigo || 'G-000'}
                              </span>
                            </div>
                            <span className={`badge ${
                              vale.estado === 'aprobado'
                                ? 'bg-success'
                                : vale.estado === 'rechazado'
                                ? 'bg-danger'
                                : 'bg-warning text-dark'
                            }`} style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              {vale.estado === 'aprobado'
                                ? 'Aprobado'
                                : vale.estado === 'rechazado'
                                ? 'Rechazado'
                                : 'Pendiente'}
                            </span>
                          </div>
                          <div style={{ padding: '16px', borderTop: '1px solid #e0e7ef' }}>
                            <div className="mb-2">
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Fecha:</span>
                              <span style={{ fontWeight: 600, color: '#374151', fontSize: '1rem', marginLeft: 6 }}>
                                {vale.fecha.toLocaleDateString()} {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="mb-2">
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Concepto:</span>
                              <span style={{ fontWeight: 600, color: '#ef4444', fontSize: '1rem', marginLeft: 6 }}>
                                {vale.concepto}
                              </span>
                            </div>
                            <div className="mb-2">
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Valor:</span>
                              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '1.1rem', marginLeft: 6 }}>
                                ${Number(vale.valor).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Aprobado por:</span>
                              {vale.estado === 'aprobado' && vale.aprobadoPor ? (
                                <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '1rem', marginLeft: 6 }}>
                                  <i className="bi bi-check-circle" style={{marginRight: 4}}></i>
                                  {vale.aprobadoPor}
                                </span>
                              ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
                                <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '1rem', marginLeft: 6 }}>
                                  <i className="bi bi-x-circle" style={{marginRight: 4}}></i>
                                  {vale.aprobadoPor}
                                </span>
                              ) : (
                                <span className="text-secondary" style={{ marginLeft: 6 }}>-</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
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