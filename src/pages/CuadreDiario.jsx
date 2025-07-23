import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { Card, Row, Col, Spinner, Alert, Table, Form, Button, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Componente separado para edición de celdas
const CeldaEditableExterna = ({ esEditable, valorActual, onCambio, tipo = 'text', opciones = null }) => {
  if (!esEditable) {
    return <span>{valorActual || '-'}</span>;
  }

  if (opciones) {
    return (
      <Form.Select
        size="sm"
        value={valorActual || ''}
        onChange={e => onCambio(e.target.value)}
        style={{ fontSize: 12, minWidth: 100 }}
      >
        <option value="">-</option>
        {opciones.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Form.Select>
    );
  }

  if (tipo === 'checkbox') {
    return (
      <Form.Check
        type="checkbox"
        checked={valorActual === true || valorActual === 'true'}
        onChange={e => onCambio(e.target.checked)}
      />
    );
  }

  return (
    <Form.Control
      size="sm"
      type={tipo}
      value={valorActual || ''}
      onChange={e => onCambio(e.target.value)}
      style={{ 
        fontSize: 12, 
        minWidth: tipo === 'number' ? 80 : 120,
        padding: '2px 6px'
      }}
      autoComplete="off"
    />
  );
};

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
  
  // Estados para edición inline
  const [editandoVale, setEditandoVale] = useState(null);
  const [valoresEditados, setValoresEditados] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  function getHoyLocal() {
    // Usar la fecha local del sistema directamente
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getFechaLocal(fecha) {
    // Convertir un objeto Date a formato YYYY-MM-DD en hora local
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const hoy = getHoyLocal();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);

  // --- FUNCION CORRECTA PARA MONTO PERCIBIDO ---
  function getMontoPercibido(vale) {
    if (vale.tipo === 'Ingreso' && vale.estado === 'aprobado') {
      // Determinar el porcentaje que le corresponde al profesional
      let porcentajeProfesional = 50; // Por defecto 50%
      
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

    const updateVales = () => {
      if (isMounted) {
        const todos = [...valesServicio, ...valesGasto];
        setVales(todos);

        const usuariosUnicos = Array.from(
          new Set(todos.map(v => v.peluqueroUid || v.peluqueroEmail || 'Desconocido'))
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

  // --- FUNCIONES PARA EDICIÓN INLINE ---
  const iniciarEdicion = (vale) => {
    setEditandoVale(vale.id);
    
    // Determinar el porcentaje actual
    let porcentajeActual = 50;
    if (vale.dividirPorDos) {
      if (typeof vale.dividirPorDos === 'string') {
        porcentajeActual = Number(vale.dividirPorDos);
      } else if (vale.dividirPorDos === true) {
        porcentajeActual = 50;
      }
    }
    
    // Cargar todos los valores existentes del vale
    setValoresEditados({
      codigo: vale.codigo || '',
      peluquero: vale.peluquero || '',
      fecha: vale.fecha ? vale.fecha.toISOString().split('T')[0] : '',
      tipo: vale.tipo || '',
      valor: vale.valor || '',
      servicio: vale.servicio || vale.concepto || '',
      concepto: vale.concepto || vale.servicio || '',
      observacion: vale.observacion || '',
      comisionExtra: vale.comisionExtra || '',
      dividirPorDos: porcentajeActual,
      local: vale.local || '',
      formaPago: vale.formaPago || '',
      estado: vale.estado || 'pendiente'
    });
  };

  const cancelarEdicion = () => {
    setEditandoVale(null);
    setValoresEditados({});
  };

  const guardarEdicion = async (vale) => {
    if (guardando) return;
    
    setGuardando(true);
    try {
      const coleccion = vale.tipo === 'Ingreso' ? 'vales_servicio' : 'vales_gasto';
      const valeRef = doc(db, coleccion, vale.id);
      
      // Preparar los datos a actualizar
      const datosActualizar = {
        valor: Number(valoresEditados.valor) || 0,
        observacion: valoresEditados.observacion || '',
        local: valoresEditados.local || '',
        formaPago: valoresEditados.formaPago || ''
      };

      // Agregar campos específicos según el tipo
      if (vale.tipo === 'Ingreso') {
        datosActualizar.servicio = valoresEditados.servicio || '';
        datosActualizar.comisionExtra = Number(valoresEditados.comisionExtra) || 0;
        datosActualizar.dividirPorDos = valoresEditados.dividirPorDos;
      } else {
        datosActualizar.concepto = valoresEditados.servicio || '';
      }

      await updateDoc(valeRef, datosActualizar);
      
      // Actualizar el estado local
      setVales(vales => vales.map(v => 
        v.id === vale.id ? { ...v, ...datosActualizar } : v
      ));
      
      setEditandoVale(null);
      setValoresEditados({});
      
      // Mostrar mensaje de éxito
      setMensaje('✅ Vale actualizado correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error('Error al guardar:', error);
      setMensaje('❌ Error al guardar los cambios');
      setTimeout(() => setMensaje(''), 5000);
    } finally {
      setGuardando(false);
    }
  };

  const handleCambioValor = (campo, valor) => {
    setValoresEditados(prev => ({
      ...prev,
      [campo]: valor
    }));
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

    // 3. Resumen general desde la perspectiva del local
    const ingresosLocal = valesFiltradosPDF
      .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + (Number(v.valor) || 0), 0);

    const montoPercibidoLocal = valesFiltradosPDF
      .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
      .reduce((a, v) => {
        const totalServicio = Number(v.valor) || 0;
        const montoProfesional = getMontoPercibido(v);
        return a + (totalServicio - montoProfesional);
      }, 0);

    const montoPercibidoProfesionales = valesFiltradosPDF
      .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + getMontoPercibido(v), 0);

    const solicitudesProfesionales = valesFiltradosPDF
      .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + (Number(v.valor) || 0), 0);

    const gananciaNegocio = montoPercibidoLocal;

    const totalPendiente = valesFiltradosPDF
      .filter(v => v.estado === 'pendiente')
      .reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);

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

    // RESUMEN GENERAL EN FORMATO TABLA COMPACTA - PERSPECTIVA DEL LOCAL
    const resumenData = [
      ['Total Facturado', 'Monto Local', 'Comisiones Prof.', 'Solicitudes Prof.', 'Ganancia Local', 'Pendiente'],
      [
        `$${ingresosLocal.toLocaleString()}`,
        `$${montoPercibidoLocal.toLocaleString()}`,
        `$${montoPercibidoProfesionales.toLocaleString()}`,
        `$${solicitudesProfesionales.toLocaleString()}`,
        `$${gananciaNegocio.toLocaleString()}`,
        `$${totalPendiente.toLocaleString()}`
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
        0: { fillColor: [220, 252, 231], textColor: [22, 163, 74] }, // Verde para total facturado
        1: { fillColor: [219, 234, 254], textColor: [37, 99, 235] }, // Azul para monto del local
        2: { fillColor: [254, 226, 226], textColor: [220, 53, 69] }, // Rojo para comisiones profesionales
        3: { fillColor: [255, 237, 213], textColor: [245, 158, 66] }, // Naranja para solicitudes
        4: { fillColor: gananciaNegocio >= 0 ? [220, 252, 231] : [254, 226, 226], textColor: gananciaNegocio >= 0 ? [22, 163, 74] : [220, 53, 69] }, // Verde/Rojo según ganancia
        5: { fillColor: [255, 237, 213], textColor: [245, 158, 66] } // Naranja para pendiente
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

  // CÁLCULOS DESDE LA PERSPECTIVA DEL LOCAL/NEGOCIO
  
  // 1. INGRESOS BRUTOS DEL LOCAL (total facturado a clientes - SIN incluir propinas)
  const ingresosLocal = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => {
      const montoServicio = Number(v.valor) || 0;
      // Las propinas (comisiones extra) no son facturación del local
      return a + montoServicio;
    }, 0);

  // 2. MONTO QUE PERCIBE EL LOCAL (ingresos - comisiones de porcentaje, SIN contar propinas)
  const montoPercibidoLocal = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => {
      const totalServicio = Number(v.valor) || 0;
      // Calcular solo la comisión por porcentaje (sin propinas)
      let porcentajeProfesional = 50; // Por defecto 50%
      
      if (v.dividirPorDos) {
        if (typeof v.dividirPorDos === 'string') {
          porcentajeProfesional = Number(v.dividirPorDos);
        } else if (v.dividirPorDos === true) {
          porcentajeProfesional = 50;
        }
      }
      
      const comisionPorcentaje = (totalServicio * porcentajeProfesional) / 100;
      const montoLocal = totalServicio - comisionPorcentaje;
      
      return a + montoLocal;
    }, 0);

  // 3. MONTO QUE PERCIBEN LOS PROFESIONALES (comisiones por servicios + propinas)
  const montoPercibidoProfesionales = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + getMontoPercibido(v), 0);

  // 3.1. PROPINAS TOTALES (comisiones extra que van 100% al profesional)
  const totalPropinas = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + (Number(v.comisionExtra) || 0), 0);

  // 4. SOLICITUDES DE DINERO DE PROFESIONALES (egresos = adelantos/préstamos)
  const solicitudesProfesionales = valesFiltrados
    .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  // 5. GANANCIA NETA DEL LOCAL (lo que queda después de pagar comisiones, NO incluye solicitudes)
  const gananciaNegocio = montoPercibidoLocal;

  // 6. MARGEN REAL DEL LOCAL (porcentaje que efectivamente se queda el negocio)
  const margenReal = ingresosLocal > 0 ? (montoPercibidoLocal / ingresosLocal) * 100 : 0;

  // Totales incluyendo pendientes para mostrar más información
  const totalIngresosPendientes = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  const totalSolicitudesPendientes = valesFiltrados
    .filter(v => v.tipo === 'Egreso' && v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

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
                              
                              // Solo mostrar usuarios que tengan nombre real (no códigos Firebase)
                              if (displayName === u && (u.includes('@') || u.length > 20)) {
                                return null; // No mostrar códigos Firebase
                              }
                              
                              return (
                                <option key={u} value={u}>
                                  {displayName}
                                </option>
                              );
                            }).filter(Boolean)}
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
                              
                              setDesde(getFechaLocal(inicioSemana));
                              setHasta(getFechaLocal(finSemana));
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
                              
                              setDesde(getFechaLocal(inicioMes));
                              setHasta(getFechaLocal(finMes));
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
                              
                              setDesde(getFechaLocal(inicioMesAnterior));
                              setHasta(getFechaLocal(finMesAnterior));
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
                          <i className="bi bi-building me-2" style={{ fontSize: 20, color: '#0891b2' }}></i>
                          <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>
                            Resumen Financiero del Local
                          </h5>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: '#64748b',
                            background: 'rgba(8, 145, 178, 0.1)',
                            padding: '2px 8px',
                            borderRadius: 8,
                            marginLeft: 8
                          }}>
                            Perspectiva del Negocio
                          </span>
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
                              <i className="bi bi-cash-stack me-1"></i>Total Facturado
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#166534' }}>
                              ${ingresosLocal.toLocaleString()}
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
                            background: 'linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(59, 130, 246, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 8 }}>
                              <i className="bi bi-building me-1"></i>Monto para el Local
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8' }}>
                              ${montoPercibidoLocal.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4 }}>
                              {margenReal.toFixed(1)}% del total facturado
                            </div>
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
                              <i className="bi bi-person-dash me-1"></i>Comisiones Profesionales
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#991b1b' }}>
                              ${montoPercibidoProfesionales.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                              {ingresosLocal > 0 ? ((montoPercibidoProfesionales / ingresosLocal) * 100).toFixed(1) : 0}% del total facturado
                            </div>
                          </div>
                        </div>
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(251, 146, 60, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#ea580c', marginBottom: 8 }}>
                              <i className="bi bi-wallet me-1"></i>Solicitudes Profesionales
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#c2410c' }}>
                              ${solicitudesProfesionales.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 11, color: '#ea580c', marginTop: 4 }}>
                              Adelantos y préstamos solicitados
                            </div>
                            {totalSolicitudesPendientes > 0 && (
                              <div style={{ fontSize: 11, color: '#ea580c', marginTop: 4 }}>
                                + ${totalSolicitudesPendientes.toLocaleString()} pendientes
                              </div>
                            )}
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
                              <i className="bi bi-clock me-1"></i>Pendiente Total
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#92400e' }}>
                              ${totalPendiente.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="col-12 col-md text-center">
                          <div style={{ 
                            background: gananciaNegocio >= 0 ? 
                              'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 
                              'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: `2px solid ${gananciaNegocio >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                          }}>
                            <div style={{ 
                              fontSize: 13, 
                              fontWeight: 600, 
                              color: gananciaNegocio >= 0 ? '#15803d' : '#dc2626', 
                              marginBottom: 8 
                            }}>
                              <i className={`bi ${gananciaNegocio >= 0 ? 'bi-trophy' : 'bi-exclamation-triangle'} me-1`}></i>
                              Ganancia del Local
                            </div>
                            <div style={{ 
                              fontSize: 20, 
                              fontWeight: 700, 
                              color: gananciaNegocio >= 0 ? '#166534' : '#991b1b'
                            }}>
                              ${gananciaNegocio.toLocaleString()}
                            </div>
                            <div style={{ 
                              fontSize: 11, 
                              color: gananciaNegocio >= 0 ? '#15803d' : '#dc2626', 
                              marginTop: 4 
                            }}>
                              <small>
                                💡 Solo incluye facturación por servicios (propinas van directo al profesional)
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Panel informativo sobre la lógica financiera */}
              <Row className="mb-4">
                <Col>
                  <Card className="border-0" style={{ 
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    borderRadius: 16,
                    border: '1px solid rgba(148, 163, 184, 0.2)'
                  }}>
                    <Card.Body className="p-3">
                      <div className="d-flex align-items-start">
                        <i className="bi bi-info-circle me-2 mt-1" style={{ fontSize: 16, color: '#6366f1' }}></i>
                        <div style={{ fontSize: 13, lineHeight: 1.4, color: '#475569' }}>
                          <strong style={{ color: '#1e293b' }}>Explicación del resumen financiero:</strong>
                          <br />
                          • <strong>Total Facturado:</strong> Dinero cobrado por servicios (SIN incluir propinas extras)
                          <br />
                          • <strong>Monto para el Local:</strong> Porción del local después de descontar comisiones por porcentaje
                          <br />
                          • <strong>Comisiones Profesionales:</strong> Comisiones por porcentaje + propinas extras (traspaso directo cliente → profesional)
                          <br />
                          • <strong>Solicitudes Profesionales:</strong> Adelantos, préstamos o retiros solicitados por los profesionales (NO afecta la ganancia del local)
                          <br />
                          • <strong>Ganancia del Local:</strong> Utilidad real del negocio (solo del monto facturado por servicios)
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
                  <Card className="border-0 shadow-sm" style={{ 
                    borderRadius: 20,
                    background: 'white',
                    border: '2px solid #e2e8f0'
                  }}>
                    <Card.Body className="p-0">
                      {/* Header de Vista General mejorado */}
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
                              <i className="bi bi-table me-2" style={{ fontSize: 24 }}></i>
                              Vista General
                            </h4>
                            <div style={{ fontSize: 14, opacity: 0.8 }}>
                              {valesFiltrados.length} transacciones en el período
                            </div>
                          </div>
                          <div style={{ 
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderRadius: 16,
                            padding: '12px 16px',
                            textAlign: 'center',
                            backdropFilter: 'blur(10px)'
                          }}>
                            <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 2 }}>REGISTROS</div>
                            <div style={{ 
                              fontSize: 20, 
                              fontWeight: 800,
                              color: '#4ade80'
                            }}>
                              {valesFiltrados.length}
                            </div>
                          </div>
                        </div>

                        {mensaje && (
                          <div style={{
                            background: mensaje.includes('✅') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            borderRadius: 12,
                            padding: 12,
                            fontSize: 13,
                            fontWeight: 500,
                            color: mensaje.includes('✅') ? '#4ade80' : '#f87171',
                            border: `1px solid ${mensaje.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            {mensaje}
                          </div>
                        )}
                      </div>
                      
                      {/* Información de edición mejorada */}
                      {(rol === 'admin' || rol === 'anfitrion') && (
                        <div style={{ 
                          padding: '16px 20px',
                          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <div style={{ 
                            fontSize: 13, 
                            color: '#475569',
                            lineHeight: 1.4
                          }}>
                            <div className="d-flex align-items-center mb-2">
                              <i className="bi bi-info-circle me-2" style={{color: '#3b82f6'}}></i>
                              <strong style={{ color: '#1e293b' }}>Panel de Edición:</strong>
                              <span className="ms-2">
                                Haz clic en <i className="bi bi-pencil mx-1" style={{color: '#3b82f6'}}></i> para editar un vale.
                              </span>
                            </div>
                            <div className="d-flex align-items-center flex-wrap gap-3">
                              <span>
                                <strong>Rol actual:</strong> 
                                <span style={{
                                  color: '#dc3545', 
                                  fontWeight: 600,
                                  background: 'rgba(220, 53, 69, 0.1)',
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  marginLeft: 4
                                }}>
                                  {rol || 'Sin rol'}
                                </span>
                              </span>
                              <span>
                                <strong>Estados:</strong> 
                                <span style={{color: '#22c55e', marginLeft: 6}}>■ Aprobado</span>
                                <span style={{color: '#dc3545', marginLeft: 6}}>■ Rechazado</span>
                                <span style={{color: '#f59e42', marginLeft: 6}}>■ Pendiente</span>
                                <span style={{color: '#6366f1', marginLeft: 6}}>■ Editando</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tabla con diseño moderno */}
                      <div style={{
                        overflowX: 'auto', 
                        width: '100%', 
                        background: "#fff", 
                        borderRadius: '0 0 20px 20px',
                        padding: '12px'
                      }}>
                    <Table
                      striped
                      bordered
                      hover
                      size="sm"
                      className="mb-0"
                      style={{
                        fontSize: '13px',
                        minWidth: '320px', // Reducido para móvil
                        background: "#fff",
                        borderRadius: 12,
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <thead style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        color: 'white'
                      }}>
    <tr>
      {/* Código - Oculto en móvil */}
      <th className="d-none d-md-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Código</th>
      
      {/* Profesional - Siempre visible */}
      <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Profesional</th>
      
      {/* Fecha - Oculto en móvil */}
      <th className="d-none d-sm-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Fecha</th>
      
      {/* Hora - Oculto en móvil */}
      <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Hora</th>
      
      {/* Tipo - Siempre visible */}
      <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Tipo</th>
      
      {/* Servicio/Concepto - Siempre visible */}
      <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Servicio</th>
      
      {/* Forma de Pago - Oculto en móvil */}
      <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Pago</th>
      
      {/* Local - Oculto en móvil */}
      <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Local</th>
      
      {/* Monto - Siempre visible */}
      <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Monto</th>
      
      {/* % Prof. - Oculto en móvil */}
      <th className="d-none d-sm-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>%</th>
      
      {/* Monto Percibido - Oculto en móvil */}
      <th className="d-none d-md-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Percibido</th>
      
      {/* Estado - Siempre visible */}
      <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Estado</th>
      
      {/* Aprobado por - Oculto en móvil */}
      <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Aprobado</th>
      
      {/* Observación - Oculto en móvil */}
      <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Observación</th>
      
      {/* Comisión Extra - Oculto en móvil */}
      <th className="d-none d-md-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Comisión</th>
      
      {/* Acciones - Siempre visible */}
      <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Acciones</th>
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
                                  editandoVale === vale.id 
                                    ? '#6366f1' // Azul para modo edición
                                    : vale.estado === 'aprobado'
                                    ? '#22c55e'
                                    : vale.estado === 'rechazado'
                                    ? '#dc3545'
                                    : '#f59e42'
                                }`,
                                background: editandoVale === vale.id 
                                  ? '#f1f5f9' // Fondo azul claro para modo edición
                                  : vale.estado === 'rechazado'
                                  ? '#fef2f2'
                                  : vale.estado === 'aprobado'
                                  ? '#f0fdf4'
                                  : '#fffbeb',
                                fontWeight: 500,
                                fontSize: 15,
                                boxShadow: editandoVale === vale.id ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <td className="d-none d-md-table-cell" style={{padding: '6px', fontWeight: 700, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', background: '#f8fafc', fontSize: '11px'}}>
                                {vale.codigo || '-'}
                              </td>
                              <td style={{padding: '6px', fontWeight: 600, color: '#2563eb', fontSize: '11px', maxWidth: '120px'}}>
                                <div style={{ 
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis' 
                                }}>
                                  {vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || 'Desconocido'}
                                </div>
                                {/* En móvil, mostrar información adicional */}
                                <div className="d-sm-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                  {vale.fecha.toLocaleDateString()} - {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="d-lg-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                  {vale.formaPago && `${vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1)}`}
                                  {vale.local && ` • ${vale.local}`}
                                </div>
                              </td>
                              <td className="d-none d-sm-table-cell" style={{padding: '6px', fontSize: '11px'}}>{vale.fecha.toLocaleDateString()}</td>
                              <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td style={{padding: '6px'}}>
                                <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`} style={{fontSize: '9px'}}>
                                  {vale.tipo === 'Ingreso' ? 'ING' : 'EGR'}
                                </span>
                              </td>
                              <td style={{padding: '6px', fontWeight: 600, color: '#374151', fontSize: '11px', maxWidth: '150px'}}>
                                <div style={{ 
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis' 
                                }}>
                                  <CeldaEditableExterna
                                    esEditable={editandoVale === vale.id}
                                    valorActual={valoresEditados.servicio !== undefined ? valoresEditados.servicio : (vale.servicio || vale.concepto || '')}
                                    onCambio={valor => handleCambioValor('servicio', valor)}
                                  />
                                </div>
                                {/* En móvil, mostrar % y comisión extra editables */}
                                <div className="d-sm-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {vale.tipo === 'Ingreso' && (
                                    <>
                                      {/* Porcentaje editable en móvil */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <span>%:</span>
                                        <CeldaEditableExterna
                                          esEditable={editandoVale === vale.id}
                                          valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (() => {
                                            if (vale.dividirPorDos) {
                                              if (typeof vale.dividirPorDos === 'string') {
                                                return vale.dividirPorDos;
                                              } else {
                                                return '50';
                                              }
                                            } else {
                                              return '100';
                                            }
                                          })()}
                                          onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                                          opciones={[
                                            {value: '100', label: '100%'},
                                            {value: '50', label: '50%'},
                                            {value: '45', label: '45%'},
                                            {value: '40', label: '40%'}
                                          ]}
                                        />
                                      </div>
                                      {/* Comisión extra */}
                                      {(vale.comisionExtra > 0 || editandoVale === vale.id) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <span style={{ color: '#6366f1', fontWeight: 600 }}>+$</span>
                                          <CeldaEditableExterna
                                            esEditable={editandoVale === vale.id}
                                            valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (vale.comisionExtra || 0)}
                                            onCambio={valor => handleCambioValor('comisionExtra', Number(valor) || 0)}
                                            tipo="number"
                                          />
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>
                                <CeldaEditableExterna
                                  esEditable={editandoVale === vale.id}
                                  valorActual={valoresEditados.formaPago !== undefined ? valoresEditados.formaPago : (vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '')}
                                  onCambio={valor => handleCambioValor('formaPago', valor)}
                                  opciones={[
                                    {value: 'efectivo', label: 'Efectivo'},
                                    {value: 'debito', label: 'Débito'},
                                    {value: 'transferencia', label: 'Transferencia'}
                                  ]}
                                />
                              </td>
                              <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>
                                <CeldaEditableExterna
                                  esEditable={editandoVale === vale.id}
                                  valorActual={valoresEditados.local !== undefined ? valoresEditados.local : (vale.local || '-')}
                                  onCambio={valor => handleCambioValor('local', valor)}
                                  opciones={[
                                    {value: 'La Tirana', label: 'La Tirana'},
                                    {value: 'Salvador Allende', label: 'Salvador Allende'}
                                  ]}
                                />
                              </td>
                              <td style={{
                                padding: '6px',
                                color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545',
                                fontWeight: 700,
                                fontSize: '12px'
                              }}>
                                {editandoVale === vale.id ? (
                                  <div className="d-flex align-items-center">
                                    <span style={{marginRight: 4, fontSize: '10px'}}>{vale.tipo === 'Ingreso' ? '+' : '-'}$</span>
                                    <CeldaEditableExterna
                                      esEditable={true}
                                      valorActual={valoresEditados.valor !== undefined ? valoresEditados.valor : (vale.valor || 0)}
                                      onCambio={valor => handleCambioValor('valor', valor)}
                                      tipo="number"
                                    />
                                  </div>
                                ) : (
                                  `${vale.tipo === 'Ingreso' ? '+' : '-'}$${Number(vale.valor || 0).toLocaleString()}`
                                )}
                                {/* En móvil, mostrar monto percibido debajo */}
                                <div className="d-md-none" style={{ fontSize: '10px', color: '#6366f1', marginTop: '2px', fontWeight: 600 }}>
                                  {vale.tipo === 'Ingreso' && vale.estado === 'aprobado' && (
                                    <>Percibido: ${getMontoPercibido(vale).toLocaleString()}</>
                                  )}
                                </div>
                              </td>
                              <td className="d-none d-sm-table-cell" style={{padding: '6px', color: '#7c3aed', fontWeight: 600, textAlign: 'center', fontSize: '11px'}}>
                                {vale.tipo === 'Ingreso' ? (
                                  editandoVale === vale.id ? (
                                    <div className="d-flex align-items-center justify-content-center">
                                      <CeldaEditableExterna
                                        esEditable={true}
                                        valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (vale.dividirPorDos || 50)}
                                        onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                                        opciones={[
                                          {value: '100', label: '100%'},
                                          {value: '50', label: '50%'},
                                          {value: '45', label: '45%'},
                                          {value: '40', label: '40%'}
                                        ]}
                                      />
                                    </div>
                                  ) : (
                                    (() => {
                                      if (vale.dividirPorDos) {
                                        if (typeof vale.dividirPorDos === 'string') {
                                          return `${vale.dividirPorDos}%`;
                                        } else {
                                          return '50%';
                                        }
                                      } else {
                                        return '100%';
                                      }
                                    })()
                                  )
                                ) : '-'}
                              </td>
                              <td className="d-none d-md-table-cell" style={{padding: '6px', color: '#6366f1', fontWeight: 700, fontSize: '11px'}}>
                                {vale.tipo === 'Ingreso' && vale.estado === 'aprobado'
                                  ? `$${getMontoPercibido(vale).toLocaleString()}`
                                  : '-'}
                              </td>
                              <td style={{padding: '6px'}}>
                                <span className={`badge ${
                                  vale.estado === 'aprobado'
                                    ? 'bg-success'
                                    : vale.estado === 'rechazado'
                                    ? 'bg-danger'
                                    : 'bg-warning text-dark'
                                }`} style={{fontSize: '9px'}}>
                                  {vale.estado === 'aprobado'
                                  ? 'OK'
                                  : vale.estado === 'rechazado'
                                  ? 'X'
                                  : 'P'}
                                </span>
                                {/* En móvil, mostrar observación debajo del estado */}
                                <div className="d-lg-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {vale.observacion && vale.observacion !== '-' && vale.observacion}
                                </div>
                              </td>
                              <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>
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
                              <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>
                                <CeldaEditableExterna
                                  esEditable={editandoVale === vale.id}
                                  valorActual={valoresEditados.observacion !== undefined ? valoresEditados.observacion : (vale.observacion || '-')}
                                  onCambio={valor => handleCambioValor('observacion', valor)}
                                />
                              </td>
                              <td className="d-none d-md-table-cell" style={{padding: '6px', color: '#6366f1', fontWeight: 700, fontSize: '11px'}}>
                                {vale.tipo === 'Ingreso' ? (
                                  editandoVale === vale.id ? (
                                    <div className="d-flex align-items-center">
                                      <span style={{marginRight: 4, fontSize: '10px'}}>+$</span>
                                      <CeldaEditableExterna
                                        esEditable={true}
                                        valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (vale.comisionExtra || 0)}
                                        onCambio={valor => handleCambioValor('comisionExtra', valor)}
                                        tipo="number"
                                      />
                                    </div>
                                  ) : (
                                    vale.comisionExtra ? `+$${Number(vale.comisionExtra).toLocaleString()}` : '-'
                                  )
                                ) : '-'}
                              </td>
                              <td style={{padding: '6px'}}>
                                  <div className="d-flex gap-1 flex-wrap">
                                    {editandoVale === vale.id ? (
                                      <>
                                        <Button
                                          variant="success"
                                          size="sm"
                                          onClick={() => guardarEdicion(vale)}
                                          disabled={guardando}
                                          title="Guardar cambios"
                                          style={{borderRadius: 8, padding: '4px 8px'}}
                                        >
                                          {guardando ? (
                                            <Spinner as="span" animation="border" size="sm" />
                                          ) : (
                                            <i className="bi bi-check" style={{fontSize: '12px'}}></i>
                                          )}
                                        </Button>
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={cancelarEdicion}
                                          disabled={guardando}
                                          title="Cancelar"
                                          style={{borderRadius: 8, padding: '4px 8px'}}
                                        >
                                          <i className="bi bi-x" style={{fontSize: '12px'}}></i>
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          onClick={() => iniciarEdicion(vale)}
                                          title="Editar"
                                          style={{borderRadius: 8, padding: '4px 8px'}}
                                        >
                                          <i className="bi bi-pencil" style={{fontSize: '12px'}}></i>
                                        </Button>
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          onClick={() => handleEliminar(vale)}
                                          title="Eliminar"
                                          style={{borderRadius: 8, padding: '4px 8px'}}
                                        >
                                          <i className="bi bi-trash" style={{fontSize: '12px'}}></i>
                                        </Button>
                                      </>
                                    )}
                                  </div>
                              </td>
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
                                  fontSize: '13px',
                                  minWidth: '320px', // Reducido para móvil
                                  background: "#fff",
                                  borderRadius: 12,
                                  overflow: 'hidden',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                <thead style={{
                                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                                  color: 'white'
                                }}>
  <tr>
    {/* Código - Oculto en móvil */}
    <th className="d-none d-md-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Código</th>
    
    {/* Profesional - Oculto en vista profesional ya que está en el header */}
    <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Profesional</th>
    
    {/* Fecha - Oculto en móvil */}
    <th className="d-none d-sm-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Fecha</th>
    
    {/* Hora - Oculto en móvil */}
    <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Hora</th>
    
    {/* Tipo - Siempre visible */}
    <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Tipo</th>
    
    {/* Servicio/Concepto - Siempre visible */}
    <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Servicio</th>
    
    {/* Forma de Pago - Oculto en móvil */}
    <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Pago</th>
    
    {/* Local - Oculto en móvil */}
    <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Local</th>
    
    {/* Monto - Siempre visible */}
    <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Monto</th>
    
    {/* % Prof. - Oculto en móvil */}
    <th className="d-none d-sm-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>%</th>
    
    {/* Monto Percibido - Oculto en móvil */}
    <th className="d-none d-md-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Percibido</th>
    
    {/* Estado - Siempre visible */}
    <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Estado</th>
    
    {/* Aprobado por - Oculto en móvil */}
    <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Aprobado</th>
    
    {/* Observación - Oculto en móvil */}
    <th className="d-none d-lg-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Observación</th>
    
    {/* Comisión Extra - Oculto en móvil */}
    <th className="d-none d-md-table-cell" style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Comisión</th>
    
    {/* Acciones - Siempre visible */}
    <th style={{padding: '8px 6px', fontWeight: 600, fontSize: 11, borderBottom: 'none'}}>Acciones</th>
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
            editandoVale === vale.id 
              ? '#6366f1' // Azul para modo edición
              : vale.estado === 'aprobado'
              ? '#22c55e'
              : vale.estado === 'rechazado'
              ? '#dc3545'
              : '#f59e42'
          }`,
          background: editandoVale === vale.id 
            ? '#f1f5f9' // Fondo azul claro para modo edición
            : vale.estado === 'rechazado'
            ? '#fef2f2'
            : vale.estado === 'aprobado'
            ? '#f0fdf4'
            : '#fffbeb',
          fontWeight: 500,
          fontSize: 15,
          boxShadow: editandoVale === vale.id ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <td className="d-none d-md-table-cell" style={{padding: '6px', fontWeight: 700, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', background: '#f8fafc', fontSize: '11px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.codigo !== undefined ? valoresEditados.codigo : (vale.codigo || '-')}
            onCambio={valor => handleCambioValor('codigo', valor)}
            tipo="text"
          />
        </td>
        <td className="d-none d-lg-table-cell" style={{padding: '6px', fontWeight: 600, color: '#2563eb', fontSize: '11px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.peluquero !== undefined ? valoresEditados.peluquero : (vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || 'Desconocido')}
            onCambio={valor => handleCambioValor('peluquero', valor)}
            tipo="text"
          />
        </td>
        <td className="d-none d-sm-table-cell" style={{padding: '6px', fontSize: '11px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.fecha !== undefined ? valoresEditados.fecha : vale.fecha.toLocaleDateString()}
            onCambio={valor => handleCambioValor('fecha', valor)}
            tipo="date"
          />
        </td>
        <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td style={{padding: '6px'}}>
          {editandoVale === vale.id ? (
            <CeldaEditableExterna
              esEditable={true}
              valorActual={valoresEditados.tipo !== undefined ? valoresEditados.tipo : vale.tipo}
              onCambio={valor => handleCambioValor('tipo', valor)}
              opciones={[
                {value: 'Ingreso', label: 'Ingreso'},
                {value: 'Egreso', label: 'Egreso'}
              ]}
            />
          ) : (
            <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`} style={{fontSize: '9px'}}>
              {vale.tipo === 'Ingreso' ? 'ING' : 'EGR'}
            </span>
          )}
          {/* En móvil, mostrar información adicional */}
          <div className="d-sm-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            {vale.fecha.toLocaleDateString()} - {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </td>
        <td style={{padding: '6px', fontWeight: 600, color: '#374151', fontSize: '11px', maxWidth: '150px'}}>
          <div style={{ 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis' 
          }}>
            <CeldaEditableExterna
              esEditable={editandoVale === vale.id}
              valorActual={valoresEditados.servicio !== undefined ? valoresEditados.servicio : (vale.servicio || vale.concepto || '-')}
              onCambio={valor => handleCambioValor('servicio', valor)}
              tipo="text"
            />
          </div>
          {/* En móvil, mostrar información adicional */}
          <div className="d-lg-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            {vale.formaPago && `${vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1)}`}
            {vale.local && ` • ${vale.local}`}
          </div>
          <div className="d-sm-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {vale.tipo === 'Ingreso' && (
              <>
                {/* Porcentaje editable en móvil */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span>%:</span>
                  <CeldaEditableExterna
                    esEditable={editandoVale === vale.id}
                    valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (() => {
                      if (vale.dividirPorDos) {
                        if (typeof vale.dividirPorDos === 'string') {
                          return vale.dividirPorDos;
                        } else {
                          return '50';
                        }
                      } else {
                        return '100';
                      }
                    })()}
                    onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                    opciones={[
                      {value: '100', label: '100%'},
                      {value: '50', label: '50%'},
                      {value: '45', label: '45%'},
                      {value: '40', label: '40%'}
                    ]}
                  />
                </div>
                {/* Comisión extra */}
                {(vale.comisionExtra > 0 || editandoVale === vale.id) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{ color: '#6366f1', fontWeight: 600 }}>+$</span>
                    <CeldaEditableExterna
                      esEditable={editandoVale === vale.id}
                      valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (vale.comisionExtra || 0)}
                      onCambio={valor => handleCambioValor('comisionExtra', Number(valor) || 0)}
                      tipo="number"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </td>
        <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.formaPago !== undefined ? valoresEditados.formaPago : (vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-')}
            onCambio={valor => handleCambioValor('formaPago', valor)}
            opciones={[
              {value: 'efectivo', label: 'Efectivo'},
              {value: 'debito', label: 'Débito'},
              {value: 'transferencia', label: 'Transferencia'}
            ]}
          />
        </td>
        <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.local !== undefined ? valoresEditados.local : (vale.local || '-')}
            onCambio={valor => handleCambioValor('local', valor)}
            opciones={[
              {value: 'La Tirana', label: 'La Tirana'},
              {value: 'Salvador Allende', label: 'Salvador Allende'}
            ]}
          />
        </td>
        <td style={{
          padding: '6px',
          color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545',
          fontWeight: 700,
          fontSize: '12px'
        }}>
          {editandoVale === vale.id ? (
            <div className="d-flex align-items-center">
              <span style={{marginRight: 4, fontSize: '10px'}}>{vale.tipo === 'Ingreso' ? '+' : '-'}$</span>
              <CeldaEditableExterna
                esEditable={true}
                valorActual={valoresEditados.valor !== undefined ? valoresEditados.valor : (vale.valor || 0)}
                onCambio={valor => handleCambioValor('valor', valor)}
                tipo="number"
              />
            </div>
          ) : (
            `${vale.tipo === 'Ingreso' ? '+' : '-'}$${Number(vale.valor || 0).toLocaleString()}`
          )}
          {/* En móvil, mostrar monto percibido */}
          <div className="d-md-none" style={{ fontSize: '10px', color: '#6366f1', marginTop: '2px', fontWeight: 600 }}>
            {vale.tipo === 'Ingreso' && vale.estado === 'aprobado' && (
              <>Percibido: ${getMontoPercibido(vale).toLocaleString()}</>
            )}
          </div>
        </td>
        <td className="d-none d-sm-table-cell" style={{padding: '6px', color: '#7c3aed', fontWeight: 600, textAlign: 'center', fontSize: '11px'}}>
          {vale.tipo === 'Ingreso' ? (
            editandoVale === vale.id ? (
              <div className="d-flex align-items-center justify-content-center">
                <CeldaEditableExterna
                  esEditable={true}
                  valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (vale.dividirPorDos || 50)}
                  onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                  opciones={[
                    {value: '100', label: '100%'},
                    {value: '50', label: '50%'},
                    {value: '45', label: '45%'},
                    {value: '40', label: '40%'}
                  ]}
                />
              </div>
            ) : (
              (() => {
                let porcentaje = 50;
                if (vale.dividirPorDos) {
                  if (typeof vale.dividirPorDos === 'string') {
                    porcentaje = Number(vale.dividirPorDos);
                  } else if (vale.dividirPorDos === true) {
                    porcentaje = 50;
                  }
                }
                return `${porcentaje}%`;
              })()
            )
          ) : '-'}
        </td>
        <td className="d-none d-md-table-cell" style={{padding: '6px', color: '#6366f1', fontWeight: 700, fontSize: '11px'}}>
          {vale.tipo === 'Ingreso' && vale.estado === 'aprobado'
            ? `$${getMontoPercibido(vale).toLocaleString()}`
            : '-'}
        </td>
        <td style={{padding: '6px'}}>
          {editandoVale === vale.id ? (
            <CeldaEditableExterna
              esEditable={true}
              valorActual={valoresEditados.estado !== undefined ? valoresEditados.estado : vale.estado}
              onCambio={valor => handleCambioValor('estado', valor)}
              opciones={[
                {value: 'pendiente', label: 'Pendiente'},
                {value: 'aprobado', label: 'Aprobado'},
                {value: 'rechazado', label: 'Rechazado'}
              ]}
            />
          ) : (
            <span className={`badge ${
              vale.estado === 'aprobado'
                ? 'bg-success'
                : vale.estado === 'rechazado'
                ? 'bg-danger'
                : 'bg-warning text-dark'
            }`} style={{fontSize: '9px'}}>
              {vale.estado === 'aprobado'
              ? 'OK'
              : vale.estado === 'rechazado'
              ? 'X'
              : 'P'}
            </span>
          )}
          {/* En móvil, mostrar observación */}
          <div className="d-lg-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vale.observacion && vale.observacion !== '-' && vale.observacion}
          </div>
        </td>
        <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>
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
        <td className="d-none d-lg-table-cell" style={{padding: '6px', fontSize: '11px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.observacion !== undefined ? valoresEditados.observacion : (vale.observacion || '-')}
            onCambio={valor => handleCambioValor('observacion', valor)}
            tipo="text"
          />
        </td>
        <td className="d-none d-md-table-cell" style={{padding: '6px', color: '#6366f1', fontWeight: 700, fontSize: '11px'}}>
          {vale.tipo === 'Ingreso' ? (
            editandoVale === vale.id ? (
              <div className="d-flex align-items-center">
                <span style={{marginRight: 4, fontSize: '10px'}}>+$</span>
                <CeldaEditableExterna
                  esEditable={true}
                  valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (vale.comisionExtra || 0)}
                  onCambio={valor => handleCambioValor('comisionExtra', valor)}
                  tipo="number"
                />
              </div>
            ) : (
              vale.comisionExtra ? `+$${Number(vale.comisionExtra).toLocaleString()}` : '-'
            )
          ) : '-'}
        </td>
        <td style={{padding: '6px'}}>
          <div className="d-flex gap-1 flex-wrap">
            {editandoVale === vale.id ? (
              <>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => guardarEdicion(vale)}
                  disabled={guardando}
                  title="Guardar cambios"
                  style={{borderRadius: 8, padding: '4px 8px'}}
                >
                  {guardando ? (
                    <Spinner as="span" animation="border" size="sm" />
                  ) : (
                    <i className="bi bi-check" style={{fontSize: '12px'}}></i>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={cancelarEdicion}
                  disabled={guardando}
                  title="Cancelar"
                  style={{borderRadius: 8, padding: '4px 8px'}}
                >
                  <i className="bi bi-x" style={{fontSize: '12px'}}></i>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => iniciarEdicion(vale)}
                  title="Editar"
                  style={{borderRadius: 8, padding: '4px 8px'}}
                >
                  <i className="bi bi-pencil" style={{fontSize: '12px'}}></i>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleEliminar(vale)}
                  title="Eliminar"
                  style={{borderRadius: 8, padding: '4px 8px'}}
                >
                  <i className="bi bi-trash" style={{fontSize: '12px'}}></i>
                </Button>
              </>
            )}
          </div>
        </td>
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