import { useRef, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, Timestamp, onSnapshot, getDoc, runTransaction } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Form, Button, Card, Row, Col, Alert, Table, Badge, Spinner } from 'react-bootstrap';

function ValesServicio() {
  const { user, rol } = useAuth();
  const [servicio, setServicio] = useState('');
  const [valor, setValor] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nombreActual, setNombreActual] = useState('');
  const [valesUsuario, setValesUsuario] = useState([]);
  const [valesGastoUsuario, setValesGastoUsuario] = useState([]);
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

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(collection(db, 'vales_gasto'), snap => {
      const vales = [];
      snap.forEach(docu => {
        const data = docu.data();
        if (data.peluqueroUid === user.uid) { // <-- CAMBIADO AQUÍ
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
  }, [user]);

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

      // --- CORRELATIVO DIARIO CON TRANSACCIÓN ---
      const hoy = getHoyLocal(); // "YYYY-MM-DD"
      const contadorRef = doc(db, 'contadores', `vales_servicio_${hoy}`);
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
      const codigoServicio = `S-${String(nuevoNumero).padStart(3, '0')}`;

      const valesRef = collection(db, 'vales_servicio');
      const docRef = doc(valesRef);

      await setDoc(docRef, {
        servicio: servicio.trim(),
        valor: Number(valor),
        peluqueroUid: user.uid,
        peluqueroEmail: user.email,
        peluqueroNombre: nombre,
        estado: 'pendiente',
        aprobadoPor: '',
        fecha: Timestamp.now(),
        codigo: codigoServicio
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

  const gastosFiltrados = valesGastoUsuario.filter(vale => {
    if (!vale.fecha) return false;
    // Asegura que la fecha sea un objeto Date
    const fechaVale = vale.fecha?.toDate ? vale.fecha.toDate() : new Date(vale.fecha);
    const fechaValeLocal = new Date(fechaVale.getTime() - fechaVale.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    // Acepta 'aprobado' o 'Aprobado' y si no existe el campo, igual lo suma
    return fechaValeLocal === fechaFiltro && String(vale.estado).toLowerCase() === 'aprobado';
  });
  const totalGastosDia = gastosFiltrados.reduce((acc, v) => acc + (Number(v.valor) || 0), 0);

  const acumuladoDia = valesFiltrados
    .filter(v => v.estado === 'aprobado')
    .reduce((acc, v) => acc + (getGanancia(v) || 0), 0);

  const acumuladoNeto = acumuladoDia - totalGastosDia;

  // Función para calcular la ganancia real
  function getGanancia(vale) {
    if (vale.estado === 'aprobado') {
      // Suma la comisión extra si existe
      const base = vale.dividirPorDos ? Number(vale.valor) / 2 : Number(vale.valor);
      return base + (Number(vale.comisionExtra) || 0);
    }
    return null;
  }

  if (
    !['admin', 'anfitrion', 'barbero', 'estilista', 'estetica'].includes(rol)
  ) {
    return <Alert variant="danger" className="mt-4 text-center">No autorizado</Alert>;
  }

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
               
                  {/* Ganancia real, gasto y ganancia neta del día */}
                  {(acumuladoDia > 0 || totalGastosDia > 0) && (
                    <div style={{ marginBottom: 10, textAlign: "right" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 17,
                          color: "#16a34a",
                          background: "#f0fdf4",
                          borderRadius: 8,
                          padding: "6px 14px",
                          boxShadow: "0 1px 4px #0001",
                          marginBottom: 4
                        }}
                      >
                        Ganancia neta del día: ${acumuladoDia.toLocaleString()} - ${totalGastosDia.toLocaleString()} = <b>${acumuladoNeto.toLocaleString()}</b>
                      </div>
                      {totalGastosDia > 0 && (
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 15,
                            color: "#dc3545",
                            marginTop: 2
                          }}
                        >
                          Gasto del día: -${totalGastosDia.toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Tabla para pantallas medianas y grandes */}
                  <div className="d-none d-md-block" style={{ overflowX: 'auto', width: '100%', background: "#fff", padding: 0 }}>
                    <Table
                      striped
                      bordered
                      hover
                      size="sm"
                      className="mb-0"
                      style={{
                        fontSize: 14,
                        minWidth: 900,
                        background: "#fff"
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{padding: '4px 6px'}}>Código</th>
                          <th style={{padding: '4px 6px'}}>Fecha</th>
                          <th style={{padding: '4px 6px'}}>Hora</th>
                          <th style={{padding: '4px 6px'}}>Servicio</th>
                          <th style={{padding: '4px 6px'}}>Valor</th>
                          <th style={{padding: '4px 6px'}}>Comisión</th>
                          <th style={{padding: '4px 6px'}}>Ganancia</th>
                          <th style={{padding: '4px 6px'}}>Estado</th>
                          <th style={{padding: '4px 6px'}}>Aprobado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valesFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center text-muted">
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
                                    ? '#dc3545'
                                    : '#f59e42'
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
                              <td style={{padding: '4px 6px', fontWeight: 700, color: '#2563eb'}}>{vale.codigo || 'S-000'}</td>
                              <td style={{padding: '4px 6px'}}>{vale.fecha.toLocaleDateString()}</td>
                              <td style={{padding: '4px 6px'}}>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td style={{padding: '4px 6px', fontWeight: 600, color: '#374151'}}>{vale.servicio}</td>
                              <td style={{padding: '4px 6px', fontWeight: 700, color: '#2563eb'}}>
                                ${Number(vale.valor).toLocaleString()}
                              </td>
                              <td style={{padding: '4px 6px', color: '#6366f1', fontWeight: 700}}>
                                {vale.comisionExtra ? `+$${Number(vale.comisionExtra).toLocaleString()}` : '-'}
                              </td>
                              <td style={{padding: '4px 6px', color: '#6366f1', fontWeight: 700}}>
                                {vale.estado === 'aprobado'
                                  ? `$${getGanancia(vale).toLocaleString()}`
                                  : vale.estado === 'rechazado'
                                    ? 'Rechazado'
                                    : 'Pendiente'}
                              </td>
                              <td style={{padding: '4px 6px'}}>
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
                              <td style={{padding: '4px 6px'}}>
                                {vale.estado === 'aprobado' && vale.aprobadoPor ? (
                                  <span style={{ color: '#22c55e', fontWeight: 700 }}>
                                    <i className="bi bi-check-circle" style={{marginRight: 4}}></i>
                                    {vale.aprobadoPor}
                                  </span>
                                ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
                                  <span style={{ color: '#dc3545', fontWeight: 700 }}>
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
                  {/* Tabla para pantallas pequeñas */}
                  <div className="d-md-none">
                    {valesFiltrados.length === 0 ? (
                      <div className="text-center text-muted py-4">
                        <i className="bi bi-info-circle" style={{ fontSize: '2rem' }}></i>
                        <p className="mb-0" style={{ fontSize: '1.1rem' }}>
                          No tienes vales enviados para esta fecha.
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
                                ? '#dc3545'
                                : '#f59e42'
                            }`
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center" style={{ padding: '12px 16px', background: '#f3f4f6' }}>
                            <div>
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Código:</span>
                              <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '1.1rem', marginLeft: 6 }}>
                                {vale.codigo || 'S-000'}
                              </span>
                            </div>
                            <div>
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
                          </div>
                          <div style={{ padding: '16px', borderTop: '1px solid #e0e7ef' }}>
                            <div className="mb-2">
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Fecha:</span>
                              <span style={{ fontWeight: 600, color: '#374151', fontSize: '1rem', marginLeft: 6 }}>
                                {vale.fecha.toLocaleDateString()} {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="mb-2">
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Servicio:</span>
                              <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '1rem', marginLeft: 6 }}>
                                {vale.servicio}
                              </span>
                            </div>
                            <div className="mb-2">
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Valor:</span>
                              <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '1.1rem', marginLeft: 6 }}>
                                ${Number(vale.valor).toLocaleString()}
                              </span>
                            </div>
                            <div className="mb-2">
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Comisión:</span>
                              <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '1.1rem', marginLeft: 6 }}>
                                {vale.comisionExtra ? `+$${Number(vale.comisionExtra).toLocaleString()}` : '-'}
                              </span>
                            </div>
                            <div className="mb-2">
                              <span style={{ fontSize: '0.9rem', color: '#374151' }}>Ganancia:</span>
                              <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '1.1rem', marginLeft: 6 }}>
                                {vale.estado === 'aprobado'
                                  ? `$${getGanancia(vale).toLocaleString()}`
                                  : vale.estado === 'rechazado'
                                    ? 'Rechazado'
                                    : 'Pendiente'}
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
                                <span style={{ color: '#dc3545', fontWeight: 700, fontSize: '1rem', marginLeft: 6 }}>
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
  const hoy = new Date();
  hoy.setHours(hoy.getHours() - hoy.getTimezoneOffset() / 60);
  return hoy.toISOString().slice(0, 10);
}

export default ValesServicio;