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
  const [vista, setVista] = useState('cards'); // <-- Por Profesional es la vista por defecto
  const [ordenColumna, setOrdenColumna] = useState('fecha');
  const [ordenDireccion, setOrdenDireccion] = useState('desc');
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
    if (vale.tipo === 'Ingreso' && vale.estado === 'aprobado') {
      const base = vale.dividirPorDos ? Number(vale.valor) / 2 : Number(vale.valor);
      return base + (Number(vale.comisionExtra) || 0);
    }
    return 0;
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
      .filter(v => v.estado === 'aprobado')
      .reduce((a, v) => {
        if (v.tipo === 'Ingreso') {
          return a + getMontoPercibido(v);
        } else if (v.tipo === 'Egreso') {
          return a - (Number(v.valor) || 0);
        }
        return a;
      }, 0);

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
      // Asegúrate de que v.fecha es un objeto Date
      const fecha = v.fecha instanceof Date ? v.fecha : new Date(v.fecha);
      rows.push([
        v.codigo || '-',
        fecha.toLocaleDateString(),
        fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        v.tipo,
        v.servicio || v.concepto || '-',
        v.formaPago ? v.formaPago.charAt(0).toUpperCase() + v.formaPago.slice(1) : '-',
        v.local || '-',
        Number(v.valor).toLocaleString(),
        getMontoPercibido(v).toLocaleString(),
                v.estado || 'pendiente',
        v.aprobadoPor || '-',
        v.observacion || '-',
        v.comisionExtra ? `+$${Number(v.comisionExtra).toLocaleString()}` : '-'
      ]);
    });

    // Dibuja la tabla única
    autoTable(doc, {
      head: [[
        'Código', 'Fecha', 'Hora', 'Tipo', 'Servicio/Concepto', 'F. Pago', 'Local',
        'Valor', 'M. Percibido', 'Estado', 'Aprobado por', 'Observación', 'Comisión'
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
        0: { cellWidth: 18 }, // Código
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
        12: { cellWidth: 18, halign: 'right' } // Comisión
      },
      theme: 'striped',
      margin: { left: 14, right: 14 },
      headStyles: { 
        fillColor: [99, 102, 241], 
        textColor: 255, 
        fontSize: 8, 
        fontStyle: 'bold' 
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
    .filter(v => v.estado === 'aprobado')
    .reduce((a, v) => {
      if (v.tipo === 'Ingreso') {
        return a + getMontoPercibido(v);
      } else if (v.tipo === 'Egreso') {
        return a - (Number(v.valor) || 0);
      }
      return a;
    }, 0);

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (error) return <Alert variant="danger">{error}</Alert>;

  const handleOrdenar = (col) => {
    if (ordenColumna === col) {
      setOrdenDireccion(ordenDireccion === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdenColumna(col);
      setOrdenDireccion('asc');
    }
  };

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
                      <Form.Select value={ordenDireccion} onChange={e => setOrdenDireccion(e.target.value)}>
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
                    <Card.Body className="resumen-caja-obento">
  <div>
    <div>Ingresos</div>
    <div className="ingresos">${totalIngresos.toLocaleString()}</div>
  </div>
  <div>
    <div>Egresos</div>
    <div className="egresos">${totalEgresos.toLocaleString()}</div>
  </div>
  <div>
    <div>Saldo Neto</div>
    <div className="saldo">${saldoNeto.toLocaleString()}</div>
  </div>
  <div>
    <div>Saldo Pendiente</div>
    <div className="pendiente">${totalPendiente.toLocaleString()}</div>
  </div>
  <div>
    <div>Monto Percibido</div>
    <div className="percibido">${totalPercibido.toLocaleString()}</div>
  </div>
</Card.Body>
                  </Card>
                </Col>
              </Row>
              {/* Selector de vista */}
              <div className="mb-3 text-center">
                <ToggleButtonGroup type="radio" name="vista" value={vista} onChange={setVista}>
                  <ToggleButton id="vista-cards" value="cards" variant="outline-primary" size="sm">
                    Por Profesional
                  </ToggleButton>
                  <ToggleButton id="vista-tabla" value="tabla" variant="outline-primary" size="sm">
                    Vista General
                  </ToggleButton>
                </ToggleButtonGroup>
                <Button variant="primary" size="sm" className="ms-3" onClick={handleExportPDF}>
                  <i className="bi bi-file-earmark-arrow-down me-1"></i>Descargar PDF
                </Button>
              </div>

              {/* Vista general (tabla global) */}
              {vista === 'tabla' ? (
                valesFiltrados.length === 0 ? (
                  <Alert variant="info">No hay vales para mostrar.</Alert>
                ) : (
                  <div className="table-responsive" style={{overflowX: 'auto', width: '100%', background: "#fff", padding: 0, marginLeft: 0, marginRight: 0}}>
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
      <th style={{padding: '4px 6px'}}>Profesional</th>
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
      <th style={{padding: '4px 6px'}}>Comisión</th>
      {(rol === 'admin' || rol === 'anfitrion') && <th style={{padding: '4px 6px'}}>Acciones</th>}
    </tr>
  </thead>
                      <tbody>
                        {valesFiltrados
                          .sort((a, b) => {
                            let valA, valB;
                            switch (ordenColumna) {
                              case 'codigo':
                                valA = a.codigo || '';
                                valB = b.codigo || '';
                                break;
                              case 'fecha':
                                valA = a.fecha;
                                valB = b.fecha;
                                break;
                              case 'hora':
                                valA = a.fecha.getHours() * 60 + a.fecha.getMinutes();
                                valB = b.fecha.getHours() * 60 + b.fecha.getMinutes();
                                break;
                              case 'tipo':
                                valA = a.tipo;
                                valB = b.tipo;
                                break;
                              case 'valor':
                                valA = Number(a.valor) || 0;
                                valB = Number(b.valor) || 0;
                                break;
                              default:
                                valA = a[ordenColumna] || '';
                                valB = b[ordenColumna] || '';
                            }
                            if (valA < valB) return ordenDireccion === 'asc' ? -1 : 1;
                            if (valA > valB) return ordenDireccion === 'asc' ? 1 : -1;
                            return 0;
                          })
                          .map(vale => (
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
                              <td style={{padding: '4px 6px', fontWeight: 700, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', background: '#f3f4f6'}}>
                                {vale.codigo || '-'}
                              </td>
                              <td style={{padding: '4px 6px', fontWeight: 600, color: '#2563eb'}}>
                                {nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || '—'}
                              </td>
                              <td style={{padding: '4px 6px'}}>{vale.fecha.toLocaleDateString()}</td>
                              <td style={{padding: '4px 6px'}}>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td style={{padding: '4px 6px'}}>
                                <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`}>
                                  {vale.tipo}
                                </span>
                              </td>
                              <td style={{padding: '4px 6px', fontWeight: 600, color: '#374151'}}>{vale.servicio || vale.concepto || '-'}</td>
                              <td style={{padding: '4px 6px'}}>{vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</td>
                              <td style={{padding: '4px 6px'}}>{vale.local || '-'}</td>
                              <td style={{
                                padding: '4px 6px',
                                color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545',
                                fontWeight: 700
                              }}>
                                {vale.tipo === 'Ingreso' ? '+' : '-'}${Number(vale.valor || 0).toLocaleString()}
                              </td>
                              <td style={{padding: '4px 6px', color: '#6366f1', fontWeight: 700}}>
                                {vale.tipo === 'Ingreso' && vale.estado === 'aprobado'
                                  ? `$${getMontoPercibido(vale).toLocaleString()}`
                                  : '-'}
                              </td>
                              {/* Estado */}
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
                              <td style={{padding: '4px 6px'}}>{vale.observacion || '-'}</td>
                              <td style={{padding: '4px 6px', color: '#6366f1', fontWeight: 700}}>
                                {vale.comisionExtra ? `+$${Number(vale.comisionExtra).toLocaleString()}` : '-'}
                              </td>
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
                      </tbody>
                    </Table>
                  </div>
                )
              ) : (
                // Vista por profesional: una tabla por profesional
                <Row>
                  {Object.entries(agrupados).map(([email, lista]) => {
                    const nombre = nombresUsuarios[email] || email;
                    const ingresos = lista.filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado').reduce((a, v) => a + (Number(v.valor) || 0), 0);
                    const egresos = lista.filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado').reduce((a, v) => a + (Number(v.valor) || 0), 0);
                    const saldo = ingresos - egresos;
                    const pendiente = lista.filter(v => v.estado === 'pendiente').reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);
                    const percibido = lista.filter(v => v.estado === 'aprobado').reduce((a, v) => {
                      if (v.tipo === 'Ingreso') return a + getMontoPercibido(v);
                      if (v.tipo === 'Egreso') return a - (Number(v.valor) || 0);
                      return a;
                    }, 0);

                    return (
                      <Col xs={12} key={email} className="mb-4">
                        <Card className="shadow-sm border-0" style={{borderRadius: 18}}>
                          <Card.Body>
                            <div style={{fontWeight: 700, fontSize: 18, color: "#2563eb", marginBottom: 8}}>
                              <i className="bi bi-person-circle me-2"></i>
                              {nombre}
                            </div>
                            <div className="mb-2">
                              <b>Ingresos:</b> <span style={{color: "#22c55e"}}>${ingresos.toLocaleString()}</span> &nbsp;
                              <b>Egresos:</b> <span style={{color: "#dc3545"}}>${egresos.toLocaleString()}</span> &nbsp;
                              <b>Saldo Neto:</b> <span style={{color: saldo >= 0 ? "#22c55e" : "#dc3545"}}>${saldo.toLocaleString()}</span> &nbsp;
                              <b>Pendiente:</b> <span style={{color: "#f59e0b"}}>${pendiente.toLocaleString()}</span> &nbsp;
                              <b>Monto Percibido:</b> <span style={{color: "#6366f1"}}>${percibido.toLocaleString()}</span>
                            </div>
                            <div style={{overflowX: 'auto'}}>
                              <Table
                                striped
                                bordered
                                hover
                                size="sm"
                                className="mb-0"
                                style={{fontSize: 14, minWidth: 900, background: "#fff"}}
                              >
                <thead>
  <tr>
    <th>Código</th>
    <th>Profesional</th>
    <th>Fecha</th>
    <th>Hora</th>
    <th>Tipo</th>
    <th>Servicio/Concepto</th>
    <th>Forma de Pago</th>
    <th>Local</th>
    <th>Monto</th>
    <th>Monto Percibido</th>
    <th>Estado</th>
    <th>Aprobado por</th>
    <th>Observación</th>
    <th>Comisión</th>
    {(rol === 'admin' || rol === 'anfitrion') && <th>Acciones</th>}
  </tr>
</thead>
                                <tbody>
                                  {lista
    .sort((a, b) => b.fecha - a.fecha)
    .map(vale => (
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
        <td style={{padding: '4px 6px', fontWeight: 700, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', background: '#f3f4f6'}}>
          {vale.codigo || '-'}
        </td>
        <td style={{padding: '4px 6px', fontWeight: 600, color: '#2563eb'}}>
          {nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || '—'}
        </td>
        <td style={{padding: '4px 6px'}}>{vale.fecha.toLocaleDateString()}</td>
        <td style={{padding: '4px 6px'}}>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td style={{padding: '4px 6px'}}>
          <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`}>
            {vale.tipo}
          </span>
        </td>
        <td style={{padding: '4px 6px', fontWeight: 600, color: '#374151'}}>{vale.servicio || vale.concepto || '-'}</td>
        <td style={{padding: '4px 6px'}}>{vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-'}</td>
        <td style={{padding: '4px 6px'}}>{vale.local || '-'}</td>
        <td style={{
          padding: '4px 6px',
          color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545',
          fontWeight: 700
        }}>
          {vale.tipo === 'Ingreso' ? '+' : '-'}${Number(vale.valor || 0).toLocaleString()}
        </td>
        <td style={{padding: '4px 6px', color: '#6366f1', fontWeight: 700}}>
          {vale.tipo === 'Ingreso' && vale.estado === 'aprobado'
            ? `$${getMontoPercibido(vale).toLocaleString()}`
            : '-'}
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
        <td style={{padding: '4px 6px'}}>{vale.observacion || '-'}</td>
        <td style={{padding: '4px 6px', color: '#6366f1', fontWeight: 700}}>
          {vale.comisionExtra ? `+$${Number(vale.comisionExtra).toLocaleString()}` : '-'}
        </td>
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
                                </tbody>
                              </Table>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default CuadreDiario;