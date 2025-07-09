import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { Card, Row, Col, Spinner, Alert, Table, Form, Button, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function CuadreDiario() {
  const [vales, setVales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ usuario: '', tipo: '', estado: '', local: '', formaPago: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [nombresUsuarios, setNombresUsuarios] = useState({});
  const { rol } = useAuth ? useAuth() : { rol: null };
  const [vista, setVista] = useState('tabla');
  const [orden, setOrden] = useState('desc');
  function getHoyLocal() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  const hoy = getHoyLocal();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);

  // --- FUNCION CORRECTA PARA MONTO PERCIBIDO ---
  function getMontoPercibido(vale) {
    if (vale.tipo === 'Ingreso' && vale.estado === 'aprobado' && vale.dividirPorDos) {
      return Number(vale.valor) / 2;
    }
    return Number(vale.valor);
  }

  useEffect(() => {
    setLoading(true);
    let valesServicio = [];
    let valesGasto = [];
    let unsub1, unsub2;
    let isMounted = true;

    const updateVales = () => {
      if (isMounted) {
        const todos = [...valesServicio, ...valesGasto];
        setVales(todos);

        const usuariosUnicos = Array.from(
          new Set(todos.map(v => v.peluqueroEmail || 'Desconocido'))
        );
        setUsuarios(usuariosUnicos);
      }
    };

    unsub1 = onSnapshot(collection(db, 'vales_servicio'), snap => {
      valesServicio = [];
      snap.forEach(doc => {
        const data = doc.data();
        valesServicio.push({
          ...data,
          tipo: 'Ingreso',
          id: doc.id,
          fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
        });
      });
      updateVales();
      setLoading(false);
    });

    unsub2 = onSnapshot(collection(db, 'vales_gasto'), snap => {
      valesGasto = [];
      snap.forEach(doc => {
        const data = doc.data();
        valesGasto.push({
          ...data,
          tipo: 'Egreso',
          id: doc.id,
          fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
        });
      });
      updateVales();
      setLoading(false);
    });

    getDocs(collection(db, 'usuarios')).then(usuariosSnap => {
      const nombres = {};
      usuariosSnap.forEach(docu => {
        const data = docu.data();
        nombres[data.email] = data.nombre || '';
      });
      setNombresUsuarios(nombres);
    }).catch(() => setError('Error al cargar los datos'));

    return () => {
      isMounted = false;
      unsub1 && unsub1();
      unsub2 && unsub2();
    };
  }, []);

  const handleFiltro = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const handleEliminar = async (vale) => {
    if (window.confirm('¿Seguro que deseas eliminar este vale?')) {
      await deleteDoc(doc(db, vale.tipo === 'Ingreso' ? 'vales_servicio' : 'vales_gasto', vale.id));
      setVales(vales => vales.filter(v => v.id !== vale.id));
    }
  };

  // --- EXPORTAR PDF ---
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // 1. Filtra los vales según los filtros actuales
    const valesFiltradosPDF = vales.filter(v => {
      if (filtros.usuario && v.peluqueroEmail !== filtros.usuario) return false;
      if (filtros.tipo && v.tipo !== filtros.tipo) return false;
      if (filtros.estado && (v.estado || 'pendiente') !== filtros.estado) return false;
      if (filtros.local && (!v.local || v.local !== filtros.local)) return false;
      if (filtros.formaPago && v.formaPago !== filtros.formaPago) return false;
      const fechaValeLocal = new Date(v.fecha.getTime() - v.fecha.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      if (fechaValeLocal < desde) return false;
      if (fechaValeLocal > hasta) return false;
      return true;
    });

    // 2. Ordena los vales por usuario y fecha
    const valesOrdenados = valesFiltradosPDF.sort((a, b) => {
      const emailA = a.peluqueroEmail || 'Desconocido';
      const emailB = b.peluqueroEmail || 'Desconocido';
      if (emailA !== emailB) return emailA.localeCompare(emailB);
      return a.fecha - b.fecha;
    });

    // 3. Resumen general
    const totalIngresos = valesFiltradosPDF
      .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + (Number(v.valor) || 0), 0);

    const totalEgresos = valesFiltradosPDF
      .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + (Number(v.valor) || 0), 0);

    const saldoNeto = totalIngresos - totalEgresos;

    const totalPendiente = valesFiltradosPDF
      .filter(v => v.estado === 'pendiente')
      .reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);

    const totalPercibido = valesFiltradosPDF
      .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + getMontoPercibido(v), 0);

    let startY = 20;

    // ENCABEZADO PRINCIPAL - MÁS COMPACTO
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMEN GENERAL DE VALES', doc.internal.pageSize.getWidth() / 2, startY, { align: 'center' });
    startY += 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Período: ${desde} - ${hasta}`, doc.internal.pageSize.getWidth() / 2, startY, { align: 'center' });
    startY += 12;

    // RESUMEN GENERAL EN FORMATO TABLA COMPACTA
    const resumenData = [
      ['Ingresos', 'Egresos', 'Saldo Neto', 'Pendiente', 'M. Percibido'],
      [
        `$${totalIngresos.toLocaleString()}`,
        `$${totalEgresos.toLocaleString()}`,
        `$${saldoNeto.toLocaleString()}`,
        `$${totalPendiente.toLocaleString()}`,
        `$${totalPercibido.toLocaleString()}`
      ]
    ];

    autoTable(doc, {
      head: [resumenData[0]],
      body: [resumenData[1]],
      startY: startY,
      styles: { 
        fontSize: 10,
        cellPadding: 4,
        halign: 'center',
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { fillColor: [220, 252, 231], textColor: [22, 163, 74] }, // Verde para ingresos
        1: { fillColor: [254, 226, 226], textColor: [220, 53, 69] }, // Rojo para egresos
        2: { fillColor: saldoNeto >= 0 ? [220, 252, 231] : [254, 226, 226], textColor: saldoNeto >= 0 ? [22, 163, 74] : [220, 53, 69] }, // Verde/Rojo según saldo
        3: { fillColor: [255, 237, 213], textColor: [245, 158, 66] }, // Naranja para pendiente
        4: { fillColor: [224, 231, 255], textColor: [99, 102, 241] } // Azul para monto percibido
      },
      theme: 'grid',
      margin: { left: 50, right: 50 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontSize: 9, fontStyle: 'bold' }
    });

    startY = doc.lastAutoTable.finalY + 15;

    // 4. TABLA ÚNICA CON TODOS LOS VALES
    const rows = [];
    let currentUser = '';
    
    valesOrdenados.forEach(v => {
      const email = v.peluqueroEmail || 'Desconocido';
      const nombre = v.peluqueroNombre || nombresUsuarios[email] || email;
      
      // Si es un usuario diferente, agrega una fila separadora
      if (currentUser !== email) {
        if (currentUser !== '') {
          // Fila separadora visual
          rows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
        }
        currentUser = email;
      }
      
      rows.push([
        nombre.length > 15 ? nombre.substring(0, 15) + '...' : nombre,
        v.fecha.toLocaleDateString(),
        v.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        v.tipo,
        v.servicio || v.concepto || '-',
        v.formaPago ? v.formaPago.charAt(0).toUpperCase() + v.formaPago.slice(1) : '-',
        v.local || '-',
        Number(v.valor).toLocaleString(),
        getMontoPercibido(v).toLocaleString(),
                v.estado || 'pendiente',
        v.aprobadoPor || '-',
        v.observacion || '-'
      ]);
    });

    // Dibuja la tabla única
    autoTable(doc, {
      head: [[
        'Usuario', 'Fecha', 'Hora', 'Tipo', 'Servicio/Concepto', 'F. Pago', 'Local',
        'Valor', 'M. Percibido', 'Estado', 'Aprobado por', 'Observación'
      ]],
      body: rows,
      startY: startY,
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold' }, // Usuario
        1: { cellWidth: 18 }, // Fecha
        2: { cellWidth: 12 }, // Hora
        3: { cellWidth: 15 }, // Tipo
        4: { cellWidth: 30 }, // Servicio/Concepto
        5: { cellWidth: 18 }, // Forma de Pago
        6: { cellWidth: 20 }, // Local
        7: { cellWidth: 18, halign: 'right' }, // Valor
        8: { cellWidth: 20, halign: 'right' }, // Monto Percibido
        9: { cellWidth: 18 }, // Estado
        10: { cellWidth: 25 }, // Aprobado por
        11: { cellWidth: 30 }, // Observación
      },
      theme: 'striped',
      margin: { left: 14, right: 14 },
      headStyles: { 
        fillColor: [99, 102, 241], 
        textColor: 255, 
        fontSize: 8, 
        fontStyle: 'bold' 
      },
      didDrawCell: function(data) {
        // Colorea las filas según el tipo
        if (data.section === 'body' && data.column.index === 3) {
          const tipo = data.cell.text[0];
          if (tipo === 'Ingreso') {
            doc.setFillColor(220, 252, 231); // Verde claro
          } else if (tipo === 'Egreso') {
            doc.setFillColor(254, 226, 226); // Rojo claro
          }
        }
      }
    });

    // 5. RESUMEN POR USUARIO AL FINAL
    const agrupadosPorUsuario = {};
    valesFiltradosPDF.forEach(v => {
      const email = v.peluqueroEmail || 'Desconocido';
      if (!agrupadosPorUsuario[email]) agrupadosPorUsuario[email] = [];
      agrupadosPorUsuario[email].push(v);
    });

    startY = doc.lastAutoTable.finalY + 15;

    if (startY + 30 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      startY = 20;
    }

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMEN POR USUARIO', doc.internal.pageSize.getWidth() / 2, startY, { align: 'center' });
    startY += 10;

    const resumenUsuarios = Object.keys(agrupadosPorUsuario).map(email => {
      const lista = agrupadosPorUsuario[email];
      const nombre = lista.find(v => v.peluqueroNombre)?.peluqueroNombre || nombresUsuarios[email] || email;
      
      const totalIngresosU = lista
        .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
        .reduce((a, v) => a + (Number(v.valor) || 0), 0);

      const totalEgresosU = lista
        .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
        .reduce((a, v) => a + (Number(v.valor) || 0), 0);

      const saldoU = totalIngresosU - totalEgresosU;

      const totalPercibidoU = lista
        .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
        .reduce((a, v) => a + getMontoPercibido(v), 0);

      return [
        nombre,
        `$${totalIngresosU.toLocaleString()}`,
        `$${totalEgresosU.toLocaleString()}`,
        `$${saldoU.toLocaleString()}`,
        `$${totalPercibidoU.toLocaleString()}`
      ];
    });

    autoTable(doc, {
      head: [['Usuario', 'Ingresos', 'Egresos', 'Saldo', 'Monto Percibido']],
      body: resumenUsuarios,
      startY: startY,
      styles: { 
        fontSize: 10,
        cellPadding: 3,
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' }
      },
      theme: 'grid',
      margin: { left: 60, right: 60 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' }
    });

    doc.save(`resumen_vales_${desde}_a_${hasta}.pdf`);
  };

  // --- FILTRADO Y RESUMENES PARA LA VISTA ---
  const valesFiltrados = vales.filter(v => {
    if (filtros.usuario && v.peluqueroEmail !== filtros.usuario) return false;
    if (filtros.tipo && v.tipo !== filtros.tipo) return false;
    if (filtros.estado && (v.estado || 'pendiente') !== filtros.estado) return false;
    if (filtros.local) {
      if (!v.local || v.local !== filtros.local) return false;
    }
    if (filtros.formaPago && v.formaPago !== filtros.formaPago) return false;
    const fechaValeLocal = new Date(v.fecha.getTime() - v.fecha.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    if (fechaValeLocal < desde) return false;
    if (fechaValeLocal > hasta) return false;
    return true;
  });

  const totalIngresos = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  const totalEgresos = valesFiltrados
    .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  const saldoNeto = totalIngresos - totalEgresos;

  const totalPendiente = valesFiltrados
    .filter(v => v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);

  const agrupados = {};
  valesFiltrados.forEach(vale => {
    const email = vale.peluqueroEmail || 'Desconocido';
    if (!agrupados[email]) agrupados[email] = [];
    agrupados[email].push(vale);
  });

  const totalPercibido = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + getMontoPercibido(v), 0);

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="cuadre-diario-container">
      <Row className="justify-content-center mt-4">
        <Col xs={12} md={12} lg={12} xl={12} style={{paddingLeft: 8, paddingRight: 8, maxWidth: "100%"}}>
          <Card className="shadow-sm border-0" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title className="mb-4 text-center" style={{fontWeight: 700, letterSpacing: '-1px', fontSize: 26}}>
                <i className="bi bi-journal-check me-2"></i>Listado de Vales
              </Card.Title>
              <Form className="mb-4">
                <Row className="g-3 justify-content-center">
                  <Col xs={12} sm={6} md={3}>
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
                  </Col>
                  <Col xs={12} sm={6} md={2}>
                    <Form.Group>
                      <Form.Label>Tipo</Form.Label>
                      <Form.Select name="tipo" value={filtros.tipo || ''} onChange={handleFiltro}>
                        <option value="">Todos</option>
                        <option value="Ingreso">Ingreso</option>
                        <option value="Egreso">Egreso</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={12} sm={6} md={2}>
                    <Form.Group>
                      <Form.Label>Estado</Form.Label>
                      <Form.Select name="estado" value={filtros.estado || ''} onChange={handleFiltro}>
                        <option value="">Todos</option>
                        <option value="aprobado">Aprobado</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="rechazado">Rechazado</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={12} sm={6} md={2}>
                    <Form.Group>
                      <Form.Label>Local</Form.Label>
                      <Form.Select name="local" value={filtros.local || ''} onChange={handleFiltro}>
                        <option value="">Todos</option>
                        <option value="La Tirana">La Tirana</option>
                        <option value="Salvador Allende">Salvador Allende</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={12} sm={6} md={2}>
                    <Form.Group>
                      <Form.Label>Forma de Pago</Form.Label>
                      <Form.Select name="formaPago" value={filtros.formaPago || ''} onChange={handleFiltro}>
                        <option value="">Todas</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="debito">Débito</option>
                        <option value="transferencia">Transferencia</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={12} sm={6} md={2}>
                    <Form.Group>
                      <Form.Label>Orden</Form.Label>
                      <Form.Select value={orden} onChange={e => setOrden(e.target.value)}>
                        <option value="desc">Más recientes primero</option>
                        <option value="asc">Más antiguos primero</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={6} sm={3} md={1}>
                    <Form.Group>
                      <Form.Label>Desde</Form.Label>
                      <Form.Control
                        type="date"
                        value={desde}
                        max={hasta}
                        onChange={e => setDesde(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={6} sm={3} md={1}>
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
                  </Col>
                </Row>
              </Form>
              {filtros.usuario && (
                <div style={{ textAlign: 'center', marginBottom: 15 }}>
                  <b>Usuario seleccionado:</b> {nombresUsuarios[filtros.usuario] || ''} ({filtros.usuario})
                </div>
              )}
              <Row className="mb-3">
                <Col>
                  <Card className="border-0 shadow-sm" style={{borderRadius: 18}}>
                    <Card.Body style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', background: "#f9fafb" }}>
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
                      <div>
                        <div><b>Saldo Pendiente</b></div>
                        <div style={{ color: '#f59e42', fontSize: 20, fontWeight: 600 }}>${totalPendiente.toLocaleString()}</div>
                      </div>
                      <div>
                        <div><b>Monto Percibido</b></div>
                        <div style={{ color: '#6366f1', fontSize: 20, fontWeight: 600 }}>${totalPercibido.toLocaleString()}</div>
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
                <Button variant="primary" size="sm" className="ms-3" onClick={handleExportPDF}>
                  <i className="bi bi-file-earmark-arrow-down me-1"></i>Descargar PDF
                </Button>
              </div>
              {Object.keys(agrupados).length === 0 ? (
                <Alert variant="info">No hay vales para mostrar.</Alert>
              ) : (
                Object.keys(agrupados).map(email => {
                  // ORDENAR LA LISTA SEGÚN EL FILTRO DE ORDEN
                  const lista = [...agrupados[email]].sort((a, b) =>
                    orden === 'asc' ? a.fecha - b.fecha : b.fecha - a.fecha
                  );
                  const nombre = lista.find(v => v.peluqueroNombre)?.peluqueroNombre || nombresUsuarios[email] || '';

                  const totalIngresosU = lista
                    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
                    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

                  const totalEgresosU = lista
                    .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
                    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

                  const saldoU = totalIngresosU - totalEgresosU;

                  const totalPendienteU = lista
                    .filter(v => v.estado === 'pendiente')
                    .reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);

                  const totalPercibidoU = lista
                    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
                    .reduce((a, v) => a + getMontoPercibido(v), 0);

                  return (
                    <div key={email} className="mb-5">
                      <h5 style={{fontWeight: 600, marginBottom: 12}}>
                        {filtros.usuario
                          ? (nombresUsuarios[email] ? `${nombresUsuarios[email]} (${email})` : email)
                          : email}
                      </h5>
                      <div className="mb-2">
                        <span style={{color:'#22c55e', fontWeight:600}}>
                          Ingresos: ${totalIngresosU.toLocaleString()}
                        </span>
                        {' | '}
                        <span style={{color:'#dc3545', fontWeight:600}}>
                          Egresos: ${totalEgresosU.toLocaleString()}
                        </span>
                        {' | '}
                        <span style={{color:saldoU>=0?'#22c55e':'#dc3545', fontWeight:600}}>
                          Saldo: ${saldoU.toLocaleString()}
                        </span>
                        {' | '}
                        <span style={{color:'#f59e42', fontWeight:600}}>
                          Pendiente: ${totalPendienteU.toLocaleString()}
                        </span>
                        {' | '}
                        <span style={{color:'#6366f1', fontWeight:600}}>
                          Monto Percibido: ${totalPercibidoU.toLocaleString()}
                        </span>
                      </div>
                      {vista === 'cards' ? (
                        <Row xs={1} md={2} lg={3} className="g-3">
                          {lista.map(vale => (
                            <Col key={vale.id}>
                              <div className={`vale-card ${vale.tipo === 'Egreso' ? 'egreso' : ''} shadow-sm p-3 mb-2 bg-white rounded`}>
                                <div>
                                  <b>{vale.fecha.toLocaleDateString()} {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
                                  <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'} ms-2`}>
                                    {vale.tipo}
                                  </span>
                                  <span className={`badge ms-2 ${
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
                                </div>
                                <div><b>Servicio/Concepto:</b> {vale.servicio || vale.concepto || '-'}</div>
                                <div><b>Forma de Pago:</b> {vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</div>
                                <div className={`monto ${vale.tipo === 'Ingreso' ? 'ingreso' : 'egreso'}`}>
                                  {vale.tipo === 'Ingreso' ? '+' : '-'}${Number(vale.valor || 0).toLocaleString()}
                                </div>
                                <div>
                                  <b>Monto Percibido:</b> <span style={{color:'#6366f1', fontWeight:600}}>${getMontoPercibido(vale).toLocaleString()}</span>
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
                              Saldo: <span style={{color: saldoU >= 0 ? '#22c55e' : '#dc3545'}}>${saldoU.toLocaleString()}</span>
                              <span style={{marginLeft: 12, color: '#f59e42'}}>Pendiente: ${totalPendienteU.toLocaleString()}</span>
                              <span style={{marginLeft: 12, color: '#6366f1'}}>Monto Percibido: ${totalPercibidoU.toLocaleString()}</span>
                            </div>
                          </Col>
                        </Row>
                      ) : (
                        <div
                          className="table-responsive"
                          style={{
                            overflowX: 'auto',
                            width: '100%',
                            background: "#fff",
                            padding: 0,
                            marginLeft: 0,
                            marginRight: 0,
                          }}
                        >
                          <Table
                            striped
                            bordered
                            hover
                            size="sm"
                            className="mb-0"
                            style={{
                              fontSize: 14,
                              minWidth: 1100,
                              background: "#fff"
                            }}
                          >
                            <thead>
                              <tr>
                                <th style={{padding: '4px 6px'}}>Código</th>
                                <th style={{padding: '4px 6px'}}>Fecha</th>
                                <th style={{padding: '4px 6px'}}>Hora</th>
                                <th style={{padding: '4px 6px'}}>Tipo</th>
                                <th style={{padding: '4px 6px'}}>Servicio/Concepto</th>
                                <th style={{padding: '4px 6px'}}>Forma de Pago</th>
                                <th style={{padding: '4px 6px'}}>Local</th>
                                <th style={{padding: '4px 6px'}}>Monto</th>
                                <th style={{padding: '4px 6px'}}>Monto Percibido</th>
                                <th style={{padding: '4px 6px'}}>Estado</th>
                                <th style={{padding: '4px 6px'}}>Aprobado por</th>
                                <th style={{padding: '4px 6px'}}>Observación</th>
                                {(rol === 'admin' || rol === 'anfitrion') && <th style={{padding: '4px 6px'}}>Acciones</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {lista.map(vale => (
                                <tr key={vale.id}>
                                  <td style={{padding: '4px 6px'}}>{vale.codigo || '-'}</td>
                                  <td style={{padding: '4px 6px'}}>{vale.fecha.toLocaleDateString()}</td>
                                  <td style={{padding: '4px 6px'}}>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                  <td style={{padding: '4px 6px'}}>
                                    <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`}>
                                      {vale.tipo}
                                    </span>
                                  </td>
                                  <td style={{padding: '4px 6px'}}>{vale.servicio || vale.concepto || '-'}</td>
                                  <td style={{padding: '4px 6px'}}>{vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</td>
                                  <td style={{padding: '4px 6px'}}>{vale.local || '-'}</td>
                                  <td style={{padding: '4px 6px', color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', fontWeight: 600 }}>
                                    {vale.tipo === 'Ingreso' ? '+' : '-'}${Number(vale.valor || 0).toLocaleString()}
                                  </td>
                                  <td style={{padding: '4px 6px', color: '#6366f1', fontWeight: 600 }}>
                                    ${getMontoPercibido(vale).toLocaleString()}
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
                                  <td style={{padding: '4px 6px'}}>{vale.observacion || '-'}</td>
                                  {(rol === 'admin' || rol === 'anfitrion') && (
                                    <td style={{padding: '4px 6px'}}>
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
                                <td colSpan={7} className="text-end"><b>Saldo</b></td>
                                <td colSpan={rol === 'admin' || rol === 'anfitrion' ? 4 : 3}>
                                  <b style={{color: saldoU >= 0 ? '#22c55e' : '#dc3545'}}>${saldoU.toLocaleString()}</b>
                                  <span style={{marginLeft: 12, color: '#f59e42'}}>Pendiente: ${totalPendienteU.toLocaleString()}</span>
                                  <span style={{marginLeft: 12, color: '#6366f1'}}>Monto Percibido: ${totalPercibidoU.toLocaleString()}</span>
                                </td>
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