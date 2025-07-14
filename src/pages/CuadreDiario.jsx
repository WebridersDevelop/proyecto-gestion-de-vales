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
      // Determinar el porcentaje que le corresponde al profesional
      let porcentajeProfesional = 100; // Por defecto 100%
      
      if (vale.dividirPorDos) {
        if (typeof vale.dividirPorDos === 'string') {
          // Nuevo sistema con porcentajes específicos
          porcentajeProfesional = Number(vale.dividirPorDos);
        } else if (vale.dividirPorDos === true) {
          // Sistema anterior (booleano) - 50%
          porcentajeProfesional = 50;
        }
      }
      
      // Calcular el monto base según el porcentaje
      const base = (Number(vale.valor) * porcentajeProfesional) / 100;
      
      // Sumar la comisión extra (no se divide)
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

    console.log('🔄 CuadreDiario - Iniciando carga de datos...');

    const updateVales = () => {
      if (isMounted) {
        const todos = [...valesServicio, ...valesGasto];
        console.log('📊 CuadreDiario - Actualizando vales:', {
          valesServicio: valesServicio.length,
          valesGasto: valesGasto.length,
          total: todos.length
        });
        setVales(todos);

        const usuariosUnicos = Array.from(
          new Set(todos.map(v => v.peluqueroUid || v.peluqueroEmail || 'Desconocido'))
        );
        setUsuarios(usuariosUnicos);
      }
    };

    unsub1 = onSnapshot(collection(db, 'vales_servicio'), snap => {
      console.log('🟢 CuadreDiario - Vales de servicio obtenidos:', snap.size);
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
      console.log('🔴 CuadreDiario - Vales de gasto obtenidos:', snap.size);
      valesGasto = [];
      snap.forEach(doc => {
        const data = doc.data();
        console.log('🔴 Vale de gasto individual:', doc.id, data);
        valesGasto.push({
          ...data,
          tipo: 'Egreso',
          id: doc.id,
          fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
        });
      });
      console.log('🔴 Total vales de gasto procesados:', valesGasto.length);
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
      if (filtros.usuario && (v.peluqueroUid !== filtros.usuario && v.peluqueroEmail !== filtros.usuario)) return false;
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
    if (filtros.usuario && (v.peluqueroUid !== filtros.usuario && v.peluqueroEmail !== filtros.usuario)) return false;
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

  console.log('🔍 CuadreDiario - Filtrado de vales:', {
    totalVales: vales.length,
    valesFiltrados: valesFiltrados.length,
    egresos: vales.filter(v => v.tipo === 'Egreso').length,
    egresosFiltrados: valesFiltrados.filter(v => v.tipo === 'Egreso').length,
    filtros: filtros,
    desde: desde,
    hasta: hasta
  });

  const totalIngresos = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  const totalEgresos = valesFiltrados
    .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  // Totales incluyendo pendientes para mostrar más información
  const totalIngresosPendientes = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  const totalEgresosPendientes = valesFiltrados
    .filter(v => v.tipo === 'Egreso' && v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  console.log('💰 CuadreDiario - Cálculos financieros detallados:', {
    valesIngreso: valesFiltrados.filter(v => v.tipo === 'Ingreso').length,
    valesEgreso: valesFiltrados.filter(v => v.tipo === 'Egreso').length,
    valesIngresoAprobados: valesFiltrados.filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado').length,
    valesEgresoAprobados: valesFiltrados.filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado').length,
    valesIngresoPendientes: valesFiltrados.filter(v => v.tipo === 'Ingreso' && v.estado === 'pendiente').length,
    valesEgresoPendientes: valesFiltrados.filter(v => v.tipo === 'Egreso' && v.estado === 'pendiente').length,
    totalIngresos: totalIngresos,
    totalEgresos: totalEgresos,
    totalIngresosPendientes: totalIngresosPendientes,
    totalEgresosPendientes: totalEgresosPendientes
  });

  const saldoNeto = totalIngresos - totalEgresos;

  const totalPendiente = valesFiltrados
    .filter(v => v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);

  const agrupados = {};
  valesFiltrados.forEach(vale => {
    // Usar UID del usuario como clave principal, con fallback al email
    const clave = vale.peluqueroUid || vale.peluqueroEmail || 'Desconocido';
    if (!agrupados[clave]) agrupados[clave] = [];
    agrupados[clave].push(vale);
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
          <Card className="shadow-sm border-0" style={{ 
            borderRadius: 24, 
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <Card.Body className="p-4">
              {/* Header moderno */}
              <div className="text-center mb-4">
                <div style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  borderRadius: 20,
                  padding: '20px',
                  color: 'white',
                  marginBottom: 24
                }}>
                  <h2 style={{ 
                    fontWeight: 700, 
                    fontSize: 28, 
                    marginBottom: 8,
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    <i className="bi bi-table me-3" style={{ fontSize: 32 }}></i>
                    {desde === hasta ? 'Cuadre Diario' : 'Cuadre por Período'}
                  </h2>
                  <p style={{ 
                    fontSize: 16, 
                    marginBottom: 0, 
                    opacity: 0.9 
                  }}>
                    {desde === hasta 
                      ? `Análisis del ${desde === getHoyLocal() ? 'día de hoy' : desde}`
                      : `Período del ${desde} al ${hasta}`
                    }
                  </p>
                </div>
              </div>
              {/* Filtros modernos */}
              <Card className="mb-4 border-0" style={{ 
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderRadius: 20 
              }}>
                <Card.Body className="p-4">
                  <div className="d-flex align-items-center mb-3">
                    <i className="bi bi-funnel me-2" style={{ fontSize: 20, color: '#6366f1' }}></i>
                    <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>Filtros</h5>
                  </div>
                  <Form>
                    <Row className="g-3 justify-content-center">
                      <Col xs={12} sm={6} md={3}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-person me-1"></i>Usuario
                          </Form.Label>
                          <Form.Select 
                            name="usuario" 
                            value={filtros.usuario} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todos</option>
                            {usuarios.map(u => {
                              // Intentar obtener el nombre desde los vales existentes
                              const valeConNombre = vales.find(v => 
                                (v.peluqueroUid === u || v.peluqueroEmail === u) && v.peluquero
                              );
                              const displayName = valeConNombre?.peluquero || nombresUsuarios[u] || u;
                              
                              return (
                                <option key={u} value={u}>
                                  {displayName !== u ? `${displayName} (${u})` : u}
                                </option>
                              );
                            })}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-arrow-up-down me-1"></i>Tipo
                          </Form.Label>
                          <Form.Select 
                            name="tipo" 
                            value={filtros.tipo || ''} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todos</option>
                            <option value="Ingreso">Ingreso</option>
                            <option value="Egreso">Egreso</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-check-circle me-1"></i>Estado
                          </Form.Label>
                          <Form.Select 
                            name="estado" 
                            value={filtros.estado || ''} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todos</option>
                            <option value="aprobado">Aprobado</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="rechazado">Rechazado</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-geo-alt me-1"></i>Local
                          </Form.Label>
                          <Form.Select 
                            name="local" 
                            value={filtros.local || ''} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todos</option>
                            <option value="La Tirana">La Tirana</option>
                            <option value="Salvador Allende">Salvador Allende</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-credit-card me-1"></i>Forma de Pago
                          </Form.Label>
                          <Form.Select 
                            name="formaPago" 
                            value={filtros.formaPago || ''} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todas</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="debito">Débito</option>
                            <option value="transferencia">Transferencia</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-sort-down me-1"></i>Orden
                          </Form.Label>
                          <Form.Select 
                            value={ordenDireccion} 
                            onChange={e => setOrdenDireccion(e.target.value)}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="desc">Más recientes primero</option>
                            <option value="asc">Más antiguos primero</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={6} sm={3} md={1}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-calendar me-1"></i>Desde
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={desde}
                            max={hasta}
                            onChange={e => setDesde(e.target.value)}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6} sm={3} md={1}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-calendar-range me-1"></i>Hasta
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={hasta}
                            min={desde}
                            onChange={e => setHasta(e.target.value)}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    
                    {/* Botones de rangos predefinidos */}
                    <Row className="mt-3">
                      <Col>
                        <div className="d-flex flex-wrap gap-2 justify-content-center">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const hoy = getHoyLocal();
                              setDesde(hoy);
                              setHasta(hoy);
                            }}
                            style={{ borderRadius: 12, fontSize: 12 }}
                          >
                            <i className="bi bi-calendar-day me-1"></i>Hoy
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const hoy = new Date();
                              const inicioSemana = new Date(hoy);
                              inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo
                              const finSemana = new Date(inicioSemana);
                              finSemana.setDate(inicioSemana.getDate() + 6); // Sábado
                              
                              const formatFecha = (fecha) => {
                                fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
                                return fecha.toISOString().slice(0, 10);
                              };
                              
                              setDesde(formatFecha(inicioSemana));
                              setHasta(formatFecha(finSemana));
                            }}
                            style={{ borderRadius: 12, fontSize: 12 }}
                          >
                            <i className="bi bi-calendar-week me-1"></i>Esta semana
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const hoy = new Date();
                              const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                              const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
                              
                              const formatFecha = (fecha) => {
                                fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
                                return fecha.toISOString().slice(0, 10);
                              };
                              
                              setDesde(formatFecha(inicioMes));
                              setHasta(formatFecha(finMes));
                            }}
                            style={{ borderRadius: 12, fontSize: 12 }}
                          >
                            <i className="bi bi-calendar-month me-1"></i>Este mes
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const hoy = new Date();
                              const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                              const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                              
                              const formatFecha = (fecha) => {
                                fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
                                return fecha.toISOString().slice(0, 10);
                              };
                              
                              setDesde(formatFecha(inicioMesAnterior));
                              setHasta(formatFecha(finMesAnterior));
                            }}
                            style={{ borderRadius: 12, fontSize: 12 }}
                          >
                            <i className="bi bi-calendar-minus me-1"></i>Mes anterior
                          </Button>
                        </div>
                      </Col>
                    </Row>
                  </Form>
                  {filtros.usuario && (
                    <div style={{ 
                      textAlign: 'center', 
                      marginTop: 16,
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)',
                      borderRadius: 16,
                      border: '2px solid rgba(139, 92, 246, 0.2)'
                    }}>
                      <i className="bi bi-person-check me-2" style={{ color: '#7c3aed' }}></i>
                      <strong style={{ color: '#5b21b6' }}>Usuario seleccionado:</strong> 
                      <span style={{ fontWeight: 600, marginLeft: 8, color: '#6d28d9' }}>
                        {(() => {
                          const valeConNombre = vales.find(v => 
                            (v.peluqueroUid === filtros.usuario || v.peluqueroEmail === filtros.usuario) && v.peluquero
                          );
                          const displayName = valeConNombre?.peluquero || nombresUsuarios[filtros.usuario] || filtros.usuario;
                          return displayName !== filtros.usuario ? `${displayName} (${filtros.usuario})` : filtros.usuario;
                        })()}
                      </span>
                    </div>
                  )}
                </Card.Body>
              </Card>
              {/* Resumen financiero moderno */}
              <Row className="mb-4">
                <Col>
                  <Card className="border-0 shadow-sm" style={{ 
                    borderRadius: 20,
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
                  }}>
                    <Card.Body className="p-4">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center">
                          <i className="bi bi-calculator me-2" style={{ fontSize: 20, color: '#0891b2' }}></i>
                          <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>Resumen Financiero</h5>
                        </div>
                        <small style={{ 
                          color: '#64748b', 
                          fontWeight: 500,
                          fontSize: 12,
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.5)',
                          borderRadius: 8
                        }}>
                          <i className="bi bi-calendar-range me-1"></i>
                          {desde === hasta 
                            ? (desde === getHoyLocal() ? 'Hoy' : desde)
                            : `${desde} - ${hasta}`
                          }
                        </small>
                      </div>
                      <div className="row g-3">
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(34, 197, 94, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 8 }}>
                              <i className="bi bi-arrow-up-circle me-1"></i>Ingresos
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#166534' }}>
                              ${totalIngresos.toLocaleString()}
                            </div>
                            {totalIngresosPendientes > 0 && (
                              <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>
                                + ${totalIngresosPendientes.toLocaleString()} pendientes
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(239, 68, 68, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>
                              <i className="bi bi-arrow-down-circle me-1"></i>Egresos
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#991b1b' }}>
                              ${totalEgresos.toLocaleString()}
                            </div>
                            {totalEgresosPendientes > 0 && (
                              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                                + ${totalEgresosPendientes.toLocaleString()} pendientes
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(59, 130, 246, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 8 }}>
                              <i className="bi bi-bar-chart me-1"></i>Saldo Neto
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8' }}>
                              ${saldoNeto.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(245, 158, 11, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#d97706', marginBottom: 8 }}>
                              <i className="bi bi-clock me-1"></i>Pendiente
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#92400e' }}>
                              ${totalPendiente.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="col-12 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(147, 51, 234, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#9333ea', marginBottom: 8 }}>
                              <i className="bi bi-wallet2 me-1"></i>Monto Percibido
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#7c2d12' }}>
                              ${totalPercibido.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Selector de vista moderno */}
              <Card className="mb-4 border-0" style={{ 
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                borderRadius: 20 
              }}>
                <Card.Body className="p-4 text-center">
                  <div className="d-flex align-items-center justify-content-center mb-3">
                    <i className="bi bi-layout-three-columns me-2" style={{ fontSize: 20, color: '#6366f1' }}></i>
                    <h6 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>Modo de Vista</h6>
                  </div>
                  <div className="d-flex justify-content-center align-items-center flex-wrap gap-3">
                    <ToggleButtonGroup type="radio" name="vista" value={vista} onChange={setVista}>
                      <ToggleButton 
                        id="vista-cards" 
                        value="cards" 
                        variant="outline-primary" 
                        size="sm"
                        style={{ 
                          borderRadius: 12,
                          fontWeight: 600,
                          padding: '8px 16px'
                        }}
                      >
                        <i className="bi bi-person-badge me-1"></i>Por Profesional
                      </ToggleButton>
                      <ToggleButton 
                        id="vista-tabla" 
                        value="tabla" 
                        variant="outline-primary" 
                        size="sm"
                        style={{ 
                          borderRadius: 12,
                          fontWeight: 600,
                          padding: '8px 16px'
                        }}
                      >
                        <i className="bi bi-table me-1"></i>Vista General
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Button 
                      variant="success" 
                      size="sm" 
                      onClick={handleExportPDF}
                      style={{ 
                        borderRadius: 12,
                        fontWeight: 600,
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none'
                      }}
                    >
                      <i className="bi bi-file-earmark-arrow-down me-1"></i>Descargar PDF
                    </Button>
                  </div>
                </Card.Body>
              </Card>

              {/* Vista general (tabla global) modernizada */}
              {vista === 'tabla' ? (
                valesFiltrados.length === 0 ? (
                  <Card className="border-0" style={{ 
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    borderRadius: 20 
                  }}>
                    <Card.Body className="text-center p-5">
                      <i className="bi bi-inbox" style={{ fontSize: 48, color: '#d97706', marginBottom: 16 }}></i>
                      <h5 style={{ color: '#92400e', fontWeight: 600 }}>No hay vales para mostrar</h5>
                      <p style={{ color: '#a16207', marginBottom: 0 }}>Ajusta los filtros para ver más resultados</p>
                    </Card.Body>
                  </Card>
                ) : (
                  <Card className="border-0 shadow-sm" style={{ borderRadius: 20 }}>
                    <Card.Body className="p-0">
                      <div className="d-flex align-items-center p-4 pb-0">
                        <i className="bi bi-table me-2" style={{ fontSize: 20, color: '#6366f1' }}></i>
                        <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>Vista General</h5>
                        <span style={{ 
                          marginLeft: 'auto',
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#64748b',
                          padding: '4px 12px',
                          background: '#f1f5f9',
                          borderRadius: 12
                        }}>
                          {valesFiltrados.length} registros
                        </span>
                      </div>
                      <div className="table-responsive" style={{
                        overflowX: 'auto', 
                        width: '100%', 
                        background: "#fff", 
                        padding: 16, 
                        marginLeft: 0, 
                        marginRight: 0,
                        borderRadius: '0 0 20px 20px'
                      }}>
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
                                {vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || 'Desconocido'}
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
                    </Card.Body>
                  </Card>
                )
              ) : (
                // Vista por profesional: una tabla por profesional
                <Row>
                  {Object.entries(agrupados).map(([clave, lista]) => {
                    // Obtener el nombre del primer vale de la lista
                    const nombre = lista[0]?.peluquero || nombresUsuarios[lista[0]?.peluqueroEmail] || lista[0]?.peluqueroEmail || clave;
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
                      <Col xs={12} key={clave} className="mb-4">
                        <Card className="shadow-sm border-0" style={{ 
                          borderRadius: 20,
                          background: 'white',
                          border: '2px solid #e2e8f0'
                        }}>
                          <Card.Body className="p-0">
                            {/* Header del profesional mejorado */}
                            <div style={{
                              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                              borderRadius: '20px 20px 0 0',
                              padding: 20,
                              color: 'white',
                              position: 'relative',
                              overflow: 'hidden'
                            }}>
                              {/* Decoración de fondo */}
                              <div style={{
                                position: 'absolute',
                                top: -20,
                                right: -20,
                                width: 100,
                                height: 100,
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '50%'
                              }}></div>
                              
                              <div className="d-flex align-items-center justify-content-between mb-3">
                                <div>
                                  <h4 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                                    <i className="bi bi-person-badge me-2" style={{ fontSize: 24 }}></i>
                                    {nombre}
                                  </h4>
                                  <div style={{ fontSize: 14, opacity: 0.8 }}>
                                    {lista.length} transacciones en el período
                                  </div>
                                </div>
                                <div style={{ 
                                  background: 'rgba(255, 255, 255, 0.15)',
                                  borderRadius: 16,
                                  padding: '12px 16px',
                                  textAlign: 'center',
                                  backdropFilter: 'blur(10px)'
                                }}>
                                  <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 2 }}>SALDO NETO</div>
                                  <div style={{ 
                                    fontSize: 20, 
                                    fontWeight: 800,
                                    color: saldo >= 0 ? '#4ade80' : '#f87171'
                                  }}>
                                    ${saldo.toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              {/* Métricas mejoradas */}
                              <div className="row g-3">
                                <div className="col-6 col-md-3">
                                  <div style={{ 
                                    background: 'rgba(34, 197, 94, 0.2)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(34, 197, 94, 0.3)'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      marginBottom: 4 
                                    }}>
                                      <i className="bi bi-arrow-up-circle me-1" style={{ color: '#4ade80', fontSize: 14 }}></i>
                                      <span style={{ fontSize: 11, opacity: 0.9 }}>INGRESOS</span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80' }}>
                                      ${ingresos.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="col-6 col-md-3">
                                  <div style={{ 
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      marginBottom: 4 
                                    }}>
                                      <i className="bi bi-arrow-down-circle me-1" style={{ color: '#f87171', fontSize: 14 }}></i>
                                      <span style={{ fontSize: 11, opacity: 0.9 }}>EGRESOS</span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>
                                      ${egresos.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="col-6 col-md-3">
                                  <div style={{ 
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(245, 158, 11, 0.3)'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      marginBottom: 4 
                                    }}>
                                      <i className="bi bi-clock-history me-1" style={{ color: '#fbbf24', fontSize: 14 }}></i>
                                      <span style={{ fontSize: 11, opacity: 0.9 }}>PENDIENTE</span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>
                                      ${pendiente.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="col-6 col-md-3">
                                  <div style={{ 
                                    background: 'rgba(147, 51, 234, 0.2)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(147, 51, 234, 0.3)'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      marginBottom: 4 
                                    }}>
                                      <i className="bi bi-wallet2 me-1" style={{ color: '#a855f7', fontSize: 14 }}></i>
                                      <span style={{ fontSize: 11, opacity: 0.9 }}>PERCIBIDO</span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#a855f7' }}>
                                      ${percibido.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Tabla de registros mejorada */}
                            <div className="p-4">
                              <div className="d-flex align-items-center justify-content-between mb-3">
                                <h6 style={{ 
                                  margin: 0, 
                                  fontWeight: 600, 
                                  color: '#1e293b',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  <i className="bi bi-list-ul me-2" style={{ fontSize: 16, color: '#6366f1' }}></i>
                                  Detalle de Transacciones
                                </h6>
                                <span style={{ 
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: '#64748b',
                                  padding: '4px 12px',
                                  background: '#f8fafc',
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0'
                                }}>
                                  {lista.length} registros
                                </span>
                              </div>
                              <div style={{
                                overflowX: 'auto',
                                background: '#f8fafc',
                                borderRadius: 12,
                                border: '1px solid #e2e8f0',
                                padding: 8
                              }}>
                              <Table
                                striped
                                hover
                                size="sm"
                                className="mb-0"
                                style={{
                                  fontSize: 14, 
                                  minWidth: 900, 
                                  background: "#fff",
                                  borderRadius: 16
                                }}
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
          {vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || 'Desconocido'}
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