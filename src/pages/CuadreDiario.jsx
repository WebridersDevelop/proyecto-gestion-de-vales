import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { Card, Row, Col, Spinner, Alert, Table, Form, Button, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function CuadreDiario() {
  const [vales, setVales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ usuario: '', tipo: '', estado: '', local: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [nombresUsuarios, setNombresUsuarios] = useState({});
  const { rol } = useAuth ? useAuth() : { rol: null };
  const [vista, setVista] = useState('tabla'); // 'tabla' o 'cards'
  // Ambos selectores de fecha, ambos por defecto el día actual
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const valesServicioSnap = await getDocs(collection(db, 'vales_servicio'));
        const valesGastoSnap = await getDocs(collection(db, 'vales_gasto'));
        const valesServicio = [];
        const valesGasto = [];

        valesServicioSnap.forEach(doc => {
          const data = doc.data();
          valesServicio.push({
            ...data,
            tipo: 'Ingreso',
            id: doc.id,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
          });
        });
        valesGastoSnap.forEach(doc => {
          const data = doc.data();
          valesGasto.push({
            ...data,
            tipo: 'Egreso',
            id: doc.id,
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
          });
        });

        const todos = [...valesServicio, ...valesGasto];
        setVales(todos);

        // Saca los usuarios únicos
        const usuariosUnicos = Array.from(
          new Set(todos.map(v => v.peluqueroEmail || 'Desconocido'))
        );
        setUsuarios(usuariosUnicos);

        // Carga todos los usuarios y sus nombres
        const usuariosSnap = await getDocs(collection(db, 'usuarios'));
        const nombres = {};
        usuariosSnap.forEach(docu => {
          const data = docu.data();
          nombres[data.email] = data.nombre || '';
        });
        setNombresUsuarios(nombres);
      } catch (err) {
        setError('Error al cargar los datos');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleFiltro = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  // Eliminar vale
  const handleEliminar = async (vale) => {
    if (window.confirm('¿Seguro que deseas eliminar este vale?')) {
      await deleteDoc(doc(db, vale.tipo === 'Ingreso' ? 'vales_servicio' : 'vales_gasto', vale.id));
      setVales(vales => vales.filter(v => v.id !== vale.id));
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Resumen de Vales', 14, 16);

    // Resumen general
    doc.setFontSize(11);
    doc.text(`Rango: ${desde} a ${hasta}`, 14, 24);
    doc.text(`Ingresos: $${totalIngresos.toLocaleString()}`, 14, 32);
    doc.text(`Egresos: $${totalEgresos.toLocaleString()}`, 14, 38);
    doc.text(`Saldo Neto: $${saldoNeto.toLocaleString()}`, 14, 44);

    // Tabla de vales
    const rows = [];
    valesFiltrados.forEach(v => {
      rows.push([
        v.fecha.toLocaleDateString(),
        v.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        v.tipo,
        v.servicio || v.concepto || '-',
        v.formaPago ? v.formaPago.charAt(0).toUpperCase() + v.formaPago.slice(1) : '-',
        Number(v.valor).toLocaleString(),
        v.estado || 'pendiente',
        v.aprobadoPor || '-',
        v.peluqueroNombre || '-'
      ]);
    });

    autoTable(doc, {
      head: [['Fecha', 'Hora', 'Tipo', 'Servicio/Concepto', 'Forma de Pago', 'Valor', 'Estado', 'Aprobado por', 'Usuario']],
      body: rows,
      startY: 50,
      styles: { fontSize: 9 }
    });

    doc.save(`resumen_vales_${desde}_a_${hasta}.pdf`);
  };

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (error) return <Alert variant="danger">{error}</Alert>;

  // Filtrado por rango de fechas (incluye ambos extremos)
  const valesFiltrados = vales.filter(v => {
    if (filtros.usuario && v.peluqueroEmail !== filtros.usuario) return false;
    if (filtros.tipo && v.tipo !== filtros.tipo) return false;
    if (filtros.estado && (v.estado || 'pendiente') !== filtros.estado) return false;
    if (filtros.local && v.local !== filtros.local) return false;
    const fechaVale = v.fecha.toISOString().slice(0, 10);
    if (fechaVale < desde) return false;
    if (fechaVale > hasta) return false;
    return true;
  });

  // Resumen contable (solo vales aprobados o pendientes)
  const totalIngresos = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado !== 'rechazado')
    .reduce((acc, v) => acc + (Number(v.valor) || 0), 0);

  const totalEgresos = valesFiltrados
    .filter(v => v.tipo === 'Egreso' && v.estado !== 'rechazado')
    .reduce((acc, v) => acc + (Number(v.valor) || 0), 0);

  const saldoNeto = totalIngresos - totalEgresos;

  // Agrupa por usuario
  const agrupados = {};
  valesFiltrados.forEach(vale => {
    const email = vale.peluqueroEmail || 'Desconocido';
    if (!agrupados[email]) agrupados[email] = [];
    agrupados[email].push(vale);
  });

  return (
    <div className="cuadre-diario-container">
      <Row className="justify-content-center mt-4">
        <Col xs={12} md={11} lg={10}>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title className="mb-4 text-center" style={{fontWeight: 600, letterSpacing: '-1px'}}>Listado de Vales</Card.Title>
              <Form className="mb-4 d-flex flex-wrap gap-3 justify-content-center">
                <Form.Group>
                  <Form.Label>Usuario</Form.Label>
                  <Form.Select name="usuario" value={filtros.usuario} onChange={handleFiltro}>
                    <option value="">Todos</option>
                    {usuarios.map(u => (
                      <option key={u} value={u}>
                        {nombresUsuarios[u] ? `${nombresUsuarios[u]} (${u})` : u}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select name="tipo" value={filtros.tipo || ''} onChange={handleFiltro}>
                    <option value="">Todos</option>
                    <option value="Ingreso">Ingreso</option>
                    <option value="Egreso">Egreso</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Estado</Form.Label>
                  <Form.Select name="estado" value={filtros.estado || ''} onChange={handleFiltro}>
                    <option value="">Todos</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="rechazado">Rechazado</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Local</Form.Label>
                  <Form.Select name="local" value={filtros.local || ''} onChange={handleFiltro}>
                    <option value="">Todos</option>
                    <option value="La Tirana">La Tirana</option>
                    <option value="Salvador Allende">Salvador Allende</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Desde</Form.Label>
                  <Form.Control
                    type="date"
                    value={desde}
                    max={hasta}
                    onChange={e => setDesde(e.target.value)}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Hasta</Form.Label>
                  <Form.Control
                    type="date"
                    value={hasta}
                    min={desde}
                    max={hoy}
                    onChange={e => setHasta(e.target.value)}
                  />
                </Form.Group>
              </Form>
              {filtros.usuario && (
                <div style={{ textAlign: 'center', marginBottom: 15 }}>
                  <b>Usuario seleccionado:</b> {nombresUsuarios[filtros.usuario] || ''} ({filtros.usuario})
                </div>
              )}
              <Row className="mb-3">
                <Col>
                  <Card className="border-0 shadow-sm" style={{borderRadius: 18}}>
                    <Card.Body style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      <div>
                        <div><b>Ingresos</b></div>
                        <div style={{ color: '#22c55e', fontSize: 20, fontWeight: 600 }}>${totalIngresos.toLocaleString()}</div>
                      </div>
                      <div>
                        <div><b>Egresos</b></div>
                        <div style={{ color: '#dc3545', fontSize: 20, fontWeight: 600 }}>${totalEgresos.toLocaleString()}</div>
                      </div>
                      <div>
                        <div><b>Saldo Neto</b></div>
                        <div style={{ color: saldoNeto >= 0 ? '#22c55e' : '#dc3545', fontSize: 20, fontWeight: 600 }}>${saldoNeto.toLocaleString()}</div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              <div className="mb-3 text-center">
                <ToggleButtonGroup type="radio" name="vista" value={vista} onChange={setVista}>
                  <ToggleButton id="vista-tabla" value="tabla" variant="outline-primary" size="sm">
                    Tabla
                  </ToggleButton>
                  <ToggleButton id="vista-cards" value="cards" variant="outline-primary" size="sm">
                    Tarjetas
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
              <Button variant="outline-secondary" size="sm" className="mb-3" onClick={handleExportPDF}>
                Descargar PDF del resumen
              </Button>
              {Object.keys(agrupados).length === 0 ? (
                <Alert variant="info">No hay vales para mostrar.</Alert>
              ) : (
                Object.keys(agrupados).map(email => {
                  const lista = agrupados[email].sort((a, b) => b.fecha - a.fecha);
                  const nombre = lista.find(v => v.peluqueroNombre)?.peluqueroNombre || nombresUsuarios[email] || '';
                  const total = lista.reduce((acc, v) => {
                    if (v.estado !== 'rechazado') {
                      return acc + (v.tipo === 'Ingreso' ? Number(v.valor) || 0 : -Number(v.valor) || 0);
                    }
                    return acc;
                  }, 0);

                  return (
                    <div key={email} className="mb-5">
                      <h5 style={{fontWeight: 600, marginBottom: 12}}>
                        {filtros.usuario
                          ? (nombresUsuarios[email] ? `${nombresUsuarios[email]} (${email})` : email)
                          : email}
                      </h5>
                      {/* Resumen por usuario */}
                      <div className="mb-2">
                        <span style={{color:'#22c55e', fontWeight:600}}>
                          Ingresos: ${lista
                            .filter(v => v.tipo === 'Ingreso' && v.estado !== 'rechazado')
                            .reduce((a, v) => a + (Number(v.valor) || 0), 0)
                            .toLocaleString()}
                        </span>
                        {' | '}
                        <span style={{color:'#dc3545', fontWeight:600}}>
                          Egresos: ${lista
                            .filter(v => v.tipo === 'Egreso' && v.estado !== 'rechazado')
                            .reduce((a, v) => a + (Number(v.valor) || 0), 0)
                            .toLocaleString()}
                        </span>
                        {' | '}
                        <span style={{color:total>=0?'#22c55e':'#dc3545', fontWeight:600}}>
                          Saldo: ${total.toLocaleString()}
                        </span>
                      </div>
                      {vista === 'cards' ? (
                        <Row xs={1} md={2} lg={3} className="g-3">
                          {lista.map(vale => (
                            <Col key={vale.id}>
                              <div className={`vale-card ${vale.tipo === 'Egreso' ? 'egreso' : ''}`}>
                                <div>
                                  <b>{vale.fecha.toLocaleDateString()} {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
                                  <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'} ms-2`}>
                                    {vale.tipo}
                                  </span>
                                  <span className={`badge bg-secondary ms-2`}>
                                    {vale.estado === 'aprobado'
                                      ? 'Aprobado'
                                      : vale.estado === 'rechazado'
                                      ? 'Rechazado'
                                      : 'Pendiente'}
                                  </span>
                                </div>
                                <div><b>Servicio/Concepto:</b> {vale.servicio || vale.concepto || '-'}</div>
                                <div><b>Forma de Pago:</b> {vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</div>
                                <div className={`monto ${vale.tipo === 'Ingreso' ? 'ingreso' : 'egreso'}`}>
                                  {vale.tipo === 'Ingreso' ? '+' : '-'}${Number(vale.valor || 0).toLocaleString()}
                                </div>
                                <div>
                                  <b>Aprobado por:</b>{' '}
                                  {vale.estado === 'aprobado' && vale.aprobadoPor ? (
                                    <span style={{ color: '#22c55e', fontWeight: 600 }}>
                                      <i className="bi bi-check-circle" style={{marginRight: 4}}></i>
                                      {vale.aprobadoPor}
                                    </span>
                                  ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
                                    <span style={{ color: '#dc3545', fontWeight: 600 }}>
                                      <i className="bi bi-x-circle" style={{marginRight: 4}}></i>
                                      {vale.aprobadoPor}
                                    </span>
                                  ) : (
                                    <span className="text-secondary">-</span>
                                  )}
                                </div>
                                <div><b>Observación:</b> {vale.observacion || '-'}</div>
                                <div><b>Local:</b> {vale.local || '-'}</div>
                                {(rol === 'admin' || rol === 'anfitrion') && (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => handleEliminar(vale)}
                                  >
                                    Eliminar
                                  </Button>
                                )}
                              </div>
                            </Col>
                          ))}
                          <Col xs={12}>
                            <div className="text-end mt-2" style={{fontWeight: 'bold', fontSize: 16}}>
                              Total: <span style={{color: total >= 0 ? '#22c55e' : '#dc3545'}}>${total.toLocaleString()}</span>
                            </div>
                          </Col>
                        </Row>
                      ) : (
                        <div style={{overflowX: 'auto', borderBottom: '2px solid #eee'}}>
                          <Table striped bordered hover size="sm" responsive="sm" className="mb-0">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Hora</th>
                                <th>Tipo</th>
                                <th>Servicio/Concepto</th>
                                <th>Forma de Pago</th>
                                <th>Local</th> {/* NUEVO */}
                                <th>Monto</th>
                                <th>Estado</th>
                                <th>Aprobado por</th>
                                <th>Observación</th>
                                {(rol === 'admin' || rol === 'anfitrion') && <th>Acciones</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {lista.map(vale => (
                                <tr key={vale.id}>
                                  <td>{vale.fecha.toLocaleDateString()}</td>
                                  <td>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td>
                                    <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`}>
                                      {vale.tipo}
                                    </span>
                                  </td>
                                  <td>{vale.servicio || vale.concepto || '-'}</td>
                                  <td>{vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</td>
                                  <td>{vale.local || '-'}</td> {/* NUEVO */}
                                  <td style={{ color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', fontWeight: 600 }}>
                                    {vale.tipo === 'Ingreso' ? '+' : '-'}${Number(vale.valor || 0).toLocaleString()}
                                  </td>
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
                                      <span style={{ color: '#22c55e', fontWeight: 600 }}>
                                        <i className="bi bi-check-circle" style={{marginRight: 4}}></i>
                                        {vale.aprobadoPor}
                                      </span>
                                    ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
                                      <span style={{ color: '#dc3545', fontWeight: 600 }}>
                                        <i className="bi bi-x-circle" style={{marginRight: 4}}></i>
                                        {vale.aprobadoPor}
                                      </span>
                                    ) : (
                                      <span className="text-secondary">-</span>
                                    )}
                                  </td>
                                  <td>{vale.observacion || '-'}</td>
                                  {(rol === 'admin' || rol === 'anfitrion') && (
                                    <td>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => handleEliminar(vale)}
                                      >
                                        Eliminar
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                              <tr>
                                <td colSpan={7} className="text-end"><b>Total</b></td>
                                <td colSpan={rol === 'admin' || rol === 'anfitrion' ? 3 : 2}><b>${total.toLocaleString()}</b></td>
                              </tr>
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default CuadreDiario;