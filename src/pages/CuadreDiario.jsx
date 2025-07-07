import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore'; // <-- agrega deleteDoc
import { Card, Row, Col, Spinner, Alert, Table, Form, Button } from 'react-bootstrap'; // <-- agrega Button
import { useAuth } from '../context/AuthContext'; // <-- si tienes control de roles

function CuadreDiario() {
  const [vales, setVales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ usuario: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [nombresUsuarios, setNombresUsuarios] = useState({});
  const { rol } = useAuth ? useAuth() : { rol: null }; // Si tienes AuthContext

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Trae todos los vales de servicio y gasto
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

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (error) return <Alert variant="danger">{error}</Alert>;

  // Filtra por usuario si se selecciona
  const valesFiltrados = filtros.usuario
    ? vales.filter(v => v.peluqueroEmail === filtros.usuario)
    : vales;

  // Resumen contable
  const totalIngresos = valesFiltrados.filter(v => v.tipo === 'Ingreso').reduce((acc, v) => acc + Number(v.valor), 0);
  const totalEgresos = valesFiltrados.filter(v => v.tipo === 'Egreso').reduce((acc, v) => acc + Number(v.valor), 0);
  const saldoNeto = totalIngresos - totalEgresos;

  // Agrupa por usuario
  const agrupados = {};
  valesFiltrados.forEach(vale => {
    const email = vale.peluqueroEmail || 'Desconocido';
    if (!agrupados[email]) agrupados[email] = [];
    agrupados[email].push(vale);
  });

  return (
    <Row className="justify-content-center mt-4">
      <Col xs={12} md={11} lg={10}>
        <Card>
          <Card.Body>
            <Card.Title className="mb-4 text-center">Listado de Vales</Card.Title>
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
            </Form>
            {filtros.usuario && (
              <div style={{ textAlign: 'center', marginBottom: 15 }}>
                <b>Usuario seleccionado:</b> {nombresUsuarios[filtros.usuario] || ''} ({filtros.usuario})
              </div>
            )}
            <Row className="mb-3">
              <Col>
                <Card>
                  <Card.Body style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                    <div>
                      <div><b>Ingresos</b></div>
                      <div style={{ color: 'green', fontSize: 20 }}>${totalIngresos.toLocaleString()}</div>
                    </div>
                    <div>
                      <div><b>Egresos</b></div>
                      <div style={{ color: 'red', fontSize: 20 }}>${totalEgresos.toLocaleString()}</div>
                    </div>
                    <div>
                      <div><b>Saldo Neto</b></div>
                      <div style={{ color: saldoNeto >= 0 ? 'green' : 'red', fontSize: 20 }}>${saldoNeto.toLocaleString()}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            {Object.keys(agrupados).length === 0 ? (
              <Alert variant="info">No hay vales para mostrar.</Alert>
            ) : (
              Object.keys(agrupados).map(email => {
                const lista = agrupados[email].sort((a, b) => b.fecha - a.fecha);
                const nombre = lista.find(v => v.peluqueroNombre)?.peluqueroNombre || nombresUsuarios[email] || '';
                const total = lista.reduce((acc, v) => acc + (v.tipo === 'Ingreso' ? v.valor : -v.valor), 0);
                return (
                  <div key={email} className="mb-5">
                    <h5>
                      {filtros.usuario
                        ? (nombresUsuarios[email] ? `${nombresUsuarios[email]} (${email})` : email)
                        : email}
                    </h5>
                    <div style={{overflowX: 'auto'}}>
                      <Table striped bordered hover size="sm" responsive="sm">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Hora</th>
                            <th>Tipo</th>
                            <th>Servicio/Concepto</th>
                            <th>Forma de Pago</th>
                            <th>Monto</th>
                            <th>Estado</th>
                            <th>Aprobado por</th>
                            <th>Observación</th> {/* <-- Nueva columna */}
                            {(rol === 'admin' || rol === 'anfitrion') && <th>Acciones</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {lista.map(vale => (
                            <tr key={vale.id}>
                              <td>{vale.fecha.toLocaleDateString()}</td>
                              <td>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td>{vale.tipo}</td>
                              <td>{vale.servicio || vale.concepto || ''}</td>
                              <td>{vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</td>
                              <td style={{ color: vale.tipo === 'Ingreso' ? 'green' : 'red' }}>
                                {vale.tipo === 'Ingreso' ? '+' : '-'}${Number(vale.valor).toLocaleString()}
                              </td>
                              <td>{vale.estado || 'pendiente'}</td>
                              <td>{vale.aprobadoPor || '-'}</td>
                              <td>{vale.observacion || '-'}</td> {/* <-- Aquí se muestra la observación */}
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
                  </div>
                );
              })
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default CuadreDiario;