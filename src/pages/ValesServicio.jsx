import { useRef, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
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
      let nombre = nombreActual;
      if (!nombre) {
        const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
        nombre = usuarioDoc.exists() && usuarioDoc.data().nombre ? usuarioDoc.data().nombre : 'Sin nombre';
      }

      const hoyLocal = getHoyLocal();
      const valesRef = collection(db, 'vales_servicio');
      const valesHoySnapshot = await getDocs(valesRef);
      const valesHoy = valesHoySnapshot.docs.filter(docu => {
        const data = docu.data();
        if (!data.fecha) return false;
        const fechaVale = data.fecha.toDate ? data.fecha.toDate() : new Date(data.fecha);
        const fechaValeLocal = new Date(fechaVale.getTime() - fechaVale.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10);
        return fechaValeLocal === hoyLocal;
      });
      const codigoServicio = `S-${String(valesHoy.length + 1).padStart(3, '0')}`;

      // --- RESTRICCIÓN DE 1 MINUTO ENTRE ENVIOS ---
      if (valesHoy.length > 0) {
        // Busca el último vale enviado por fecha
        const ultimoVale = valesHoy.reduce((a, b) => {
          const fechaA = a.data().fecha.toDate ? a.data().fecha.toDate() : new Date(a.data().fecha);
          const fechaB = b.data().fecha.toDate ? b.data().fecha.toDate() : new Date(b.data().fecha);
          return fechaA > fechaB ? a : b;
        });
        const fechaUltimo = ultimoVale.data().fecha.toDate ? ultimoVale.data().fecha.toDate() : new Date(ultimoVale.data().fecha);
        const ahora = new Date();
        const diffMs = ahora - fechaUltimo;
        if (diffMs < 60000) {
          setMensaje('Debes esperar al menos 1 minuto antes de enviar otro vale.');
          setLoading(false);
          return;
        }
      }
      // --- FIN BLOQUE NUEVO ---

      await addDoc(valesRef, {
        servicio: servicio.trim(),
        valor: Number(valor),
        peluqueroUid: user.uid,
        peluqueroEmail: user.email,
        peluqueroNombre: nombre,
        estado: 'pendiente',
        aprobadoPor: '',
        fecha: Timestamp.now(),
        codigo: codigoServicio // <--- aquí guardas el código con prefijo S-
      });

      setServicio('');
      setValor('');
      if (servicioRef.current) servicioRef.current.blur();
      if (valorRef.current) valorRef.current.blur();

      setMensaje('¡Vale enviado correctamente!');
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
    const fechaValeLocal = new Date(vale.fecha.getTime() - vale.fecha.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    return fechaValeLocal === fechaFiltro;
  });

  // Función para calcular la ganancia real
  function getGanancia(vale) {
    if (vale.estado === 'aprobado') {
      if (vale.dividirPorDos) {
        return Number(vale.valor) / 2;
      }
      return Number(vale.valor);
    }
    return null;
  }

  // Cambia aquí la lógica de acceso para los nuevos roles
  if (
    !['admin', 'anfitrion', 'barbero', 'estilista', 'estetica'].includes(rol)
  ) {
    return <Alert variant="danger" className="mt-4 text-center">No autorizado</Alert>;
  }

  // Cambia el return principal por este bloque para unificar la estética:
  return (
    <div
      className="container"
      style={{
        background: "#f8fafc",
        minHeight: "100vh",
        paddingTop: 32,
        paddingBottom: 32,
      }}
    >
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8} xl={7}>
          <Card
            className="shadow-sm border-0"
            style={{
              borderRadius: 22,
              background: "#fff",
              boxShadow: "0 2px 16px #0001",
              borderLeft: "8px solid #2563eb",
            }}
          >
            <Card.Body>
              <Card.Title
                className="mb-4 text-center"
                style={{
                  fontWeight: 800,
                  letterSpacing: '-1px',
                  fontSize: 28,
                  color: "#2563eb",
                  textShadow: "0 1px 0 #e0e7ef",
                }}
              >
                <i className="bi bi-receipt me-2"></i>Vales de Servicio
              </Card.Title>
              {user && (
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: 18,
                    fontWeight: 600,
                    color: "#444",
                  }}
                >
                  <span
                    style={{
                      background: "#e0e7ef",
                      borderRadius: 10,
                      padding: "6px 18px",
                      fontSize: 17,
                      boxShadow: "0 1px 4px #0001",
                    }}
                  >
                    <i className="bi bi-person-circle me-1"></i>
                    {nombreActual}
                  </span>
                </div>
              )}
              {(['barbero', 'estilista', 'estetica', 'admin', 'anfitrion'].includes(rol)) && (
                <Form
                  onSubmit={handleSubmit}
                  className="mb-4 p-3"
                  style={{
                    background: "#f1f5f9",
                    borderRadius: 14,
                    boxShadow: "0 1px 8px #0001",
                    borderLeft: "4px solid #2563eb",
                  }}
                >
                  <Row className="g-3">
                    <Col xs={12} md={7}>
                      <Form.Group controlId="servicio">
                        <Form.Label style={{ fontWeight: 600, color: "#2563eb" }}>Servicio</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Ej: Corte de cabello"
                          value={servicio}
                          onChange={e => setServicio(e.target.value)}
                          autoFocus
                          ref={servicioRef}
                          style={{ borderRadius: 8, border: "1.5px solid #c7d2fe" }}
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={5}>
                      <Form.Group controlId="valor">
                        <Form.Label style={{ fontWeight: 600, color: "#2563eb" }}>Valor</Form.Label>
                        <Form.Control
                          type="number"
                          placeholder="Ej: 10000"
                          value={valor}
                          onChange={e => setValor(e.target.value)}
                          min={1}
                          ref={valorRef}
                          style={{ borderRadius: 8, border: "1.5px solid #c7d2fe" }}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <div className="d-grid mt-3">
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={loading}
                      style={{
                        fontWeight: 700,
                        fontSize: 17,
                        borderRadius: 8,
                        boxShadow: "0 1px 6px #2563eb22",
                      }}
                    >
                      {loading ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        <>
                          <i className="bi bi-plus-circle me-1"></i>Enviar Vale
                        </>
                      )}
                    </Button>
                  </div>
                  {mensaje && (
                    <Alert
                      className="mt-3 mb-0"
                      variant={mensaje.startsWith('¡') ? 'success' : 'danger'}
                      style={{
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 16,
                      }}
                    >
                      {mensaje}
                    </Alert>
                  )}
                </Form>
              )}
              {user && (
                <>
                  <hr />
                  <h5
                    className="mb-3"
                    style={{
                      fontWeight: 700,
                      color: "#2563eb",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    <i className="bi bi-list-ul me-2"></i>Mis vales enviados
                  </h5>
                  <Form.Group className="mb-3" controlId="fechaFiltro">
                    <Form.Label style={{ fontWeight: 600, color: "#2563eb" }}>
                      Filtrar por fecha
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={fechaFiltro}
                      max={getHoyLocal()}
                      onChange={e => setFechaFiltro(e.target.value)}
                      style={{
                        maxWidth: 200,
                        borderRadius: 8,
                        border: "1.5px solid #c7d2fe",
                      }}
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
                        textAlign: "right",
                        background: "#e0e7ef",
                        borderRadius: 8,
                        padding: "6px 14px",
                        boxShadow: "0 1px 4px #0001",
                      }}
                    >
                      Acumulado del día (ganancia real, aprobados): ${valesFiltrados
                        .filter(v => v.estado === 'aprobado')
                        .reduce((acc, v) => acc + (getGanancia(v) || 0), 0)
                        .toLocaleString()}
                    </div>
                  )}
                  {/* Tabla para pantallas medianas y grandes */}
                  <div className="d-none d-md-block" style={{ overflowX: 'auto' }}>
                    <Table
                      striped
                      bordered
                      hover
                      size="sm"
                      responsive="md"
                      className="mb-0"
                      style={{
                        borderRadius: 14,
                        overflow: 'hidden',
                        boxShadow: "0 1px 8px #0001",
                        background: "#f8fafc",
                      }}
                    >
                      <thead style={{ background: "#f3f4f6" }}>
                        <tr>
                          <th>Código</th>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Servicio</th>
                          <th>Valor</th>
                          <th>Ganancia</th>
                          <th>Estado</th>
                          <th>Aprobado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valesFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center text-muted">
                              No tienes vales enviados para esta fecha.
                            </td>
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
                              <td style={{ fontWeight: 700, color: '#2563eb', background: '#e0e7ef' }}>
                                {vale.codigo || 'S-000'}
                              </td>
                              <td>{vale.fecha.toLocaleDateString()}</td>
                              <td>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td style={{ fontWeight: 600, color: '#374151' }}>{vale.servicio}</td>
                              <td style={{ fontWeight: 700, color: '#2563eb' }}>
                                ${Number(vale.valor).toLocaleString()}
                              </td>
                              <td style={{ fontWeight: 700, color: '#6366f1' }}>
                                {vale.estado === 'aprobado'
                                  ? `$${getGanancia(vale).toLocaleString()}`
                                  : <span className="text-muted">-</span>
                                }
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
                      <div className="text-center text-muted p-4">
                        <i className="bi bi-inbox" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
                        <p className="mt-2 mb-0">No tienes vales enviados para esta fecha.</p>
                      </div>
                    ) : (
                      <div className="row g-2">
                        {valesFiltrados.map(vale => (
                          <div key={vale.id} className="col-12">
                            <div
                              className="card border-0 shadow-sm"
                              style={{
                                borderRadius: 12,
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
                              <div className="card-body p-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <div className="d-flex align-items-center">
                                    <span
                                      style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        color: '#2563eb',
                                        backgroundColor: '#e0e7ef',
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        marginRight: 8,
                                      }}
                                    >
                                      {vale.codigo || 'S-000'}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                      {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
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
                                </div>
                                <div
                                  style={{
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: '#374151',
                                    marginBottom: 8,
                                  }}
                                >
                                  {vale.servicio}
                                </div>
                                <div className="d-flex justify-content-between align-items-center">
                                  <div>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Valor: </span>
                                    <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '1rem' }}>
                                      ${Number(vale.valor).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Ganancia: </span>
                                    <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '1rem' }}>
                                      {vale.estado === 'aprobado'
                                        ? `$${getGanancia(vale).toLocaleString()}`
                                        : <span style={{ color: '#9ca3af' }}>-</span>
                                      }
                                    </span>
                                  </div>
                                </div>
                                {(vale.estado === 'aprobado' || vale.estado === 'rechazado') && vale.aprobadoPor && (
                                  <div
                                    style={{
                                      fontSize: '0.8rem',
                                      color: vale.estado === 'aprobado' ? '#16a34a' : '#ef4444',
                                      marginTop: 6,
                                      paddingTop: 6,
                                      borderTop: '1px solid #e0e7ef',
                                      fontWeight: 700,
                                    }}
                                  >
                                    <i className={`bi bi-${vale.estado === 'aprobado' ? 'check' : 'x'}-circle me-1`}></i>
                                    {vale.aprobadoPor}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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

/* 
  Reglas de seguridad de Firestore para la colección 'vales_servicio':

  allow read, write: if request.auth != null;

  - Permite a los usuarios autenticados leer y escribir en la colección.
  - Los usuarios no autenticados no podrán acceder a esta colección.
*/

export default ValesServicio;