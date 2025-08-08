import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, updateDoc, doc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Card, Row, Col, Table, Button, Alert, Spinner, Modal, Form, Badge, ButtonGroup } from 'react-bootstrap';
import { useMediaQuery } from 'react-responsive';
import React from 'react';

function AprobarValesServicio() {
  const { user, rol } = useAuth();
  const [valesServicio, setValesServicio] = useState([]);
  const [valesGasto, setValesGasto] = useState([]);
  const [valesPendientes, setValesPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [valeActual, setValeActual] = useState(null);
  const [accionModal, setAccionModal] = useState(''); // 'aprobar' o 'rechazar'
  const [observacion, setObservacion] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [local, setLocal] = useState('');
  const [dividirPorDos, setDividirPorDos] = useState('100');
  const [comisionExtra, setComisionExtra] = useState(0);
  
  // Nuevos estados para filtros y funcionalidades mejoradas
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos', 'servicio', 'gasto'
  const [filtroValor, setFiltroValor] = useState('todos'); // 'todos', 'alto', 'medio', 'bajo'
  const [busqueda, setBusqueda] = useState('');
  const [filtroPeluquero, setFiltroPeluquero] = useState('todos'); // Nuevo filtro por peluquero
  const [filtroFecha, setFiltroFecha] = useState(''); // Nuevo filtro por fecha
  const [ordenamiento, setOrdenamiento] = useState('nuevo'); // 'nuevo', 'antiguo'
  const [peluquerosUnicos, setPeluquerosUnicos] = useState([]); // Lista de peluqueros
  const [valesSeleccionados, setValesSeleccionados] = useState([]);
  const [showMasivo, setShowMasivo] = useState(false);
  
  // Estados para vista de tarjetas individuales
  const [indiceActual, setIndiceActual] = useState(0);
  const [modoTarjeta, setModoTarjeta] = useState(false); // Empezar en modo tabla por defecto

  const isMobile = useMediaQuery({ maxWidth: 767 });

  // Forzar modo tarjeta en móvil para mejor UX
  useEffect(() => {
    if (isMobile) {
      setModoTarjeta(true);
    }
  }, [isMobile]);

  // useEffect adicional para manejar la carga inicial
  useEffect(() => {
    // Simular un pequeño delay para asegurar que los datos se carguen
    const timer = setTimeout(() => {
      if (valesServicio.length === 0 && valesGasto.length === 0) {
        setLoading(false); // Si no hay datos después de un tiempo, quitar loading
      }
    }, 3000); // 3 segundos de timeout

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Query simplificado - prioriza velocidad sobre ordenamiento perfecto
    const qServicio = query(
      collection(db, 'vales_servicio'),
      where('estado', '==', 'pendiente'),
      limit(100) // Sin orderBy para evitar delays de índices
    );
    
    const unsub = onSnapshot(qServicio, snap => {
      const arr = [];
      snap.forEach(docu => {
        const data = docu.data();
        arr.push({
          ...data,
          id: docu.id,
          fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha),
          coleccion: 'vales_servicio',
          tipo: 'servicio'
        });
      });
      // Ordenar en cliente por fecha descendente (más recientes primero)
      arr.sort((a, b) => b.fecha - a.fecha);
      setValesServicio(arr);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Query simplificado para vales de gasto pendientes
    const qGasto = query(
      collection(db, 'vales_gasto'),
      where('estado', '==', 'pendiente'),
      limit(100) // Sin orderBy para respuesta instantánea
    );
    
    const unsub = onSnapshot(qGasto, snap => {
      const arr = [];
      snap.forEach(docu => {
        const data = docu.data();
        arr.push({
          ...data,
          id: docu.id,
          fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha),
          coleccion: 'vales_gasto',
          tipo: 'gasto'
        });
      });
      // Ordenar en cliente por fecha descendente
      arr.sort((a, b) => b.fecha - a.fecha);
      setValesGasto(arr);
    });
    return () => unsub();
  }, []);

  // useEffect para extraer peluqueros únicos - OPTIMIZADO para evitar loops
  useEffect(() => {
    // Solo actualizar si realmente hay cambios
    if (valesServicio.length === 0 && valesGasto.length === 0) return;
    
    const valesCombinados = [...valesServicio, ...valesGasto];
    const peluquerosSet = new Set();
    
    valesCombinados.forEach(vale => {
      const nombrePeluquero = vale.peluqueroNombre || vale.peluquero || 'Sin nombre';
      const emailPeluquero = vale.peluqueroEmail || '';
      peluquerosSet.add(JSON.stringify({ nombre: nombrePeluquero, email: emailPeluquero }));
    });
    
    const peluquerosArray = Array.from(peluquerosSet).map(str => JSON.parse(str));
    const sortedPeluqueros = peluquerosArray.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Solo actualizar si hay cambios reales
    setPeluquerosUnicos(prev => {
      if (JSON.stringify(prev) === JSON.stringify(sortedPeluqueros)) return prev;
      return sortedPeluqueros;
    });
  }, [valesServicio.length, valesGasto.length]); // Solo trigger en cambios de cantidad

  useEffect(() => {
    const valesCombinados = [...valesServicio, ...valesGasto];
    let valesFiltrados = valesCombinados;

    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      valesFiltrados = valesFiltrados.filter(vale => vale.tipo === filtroTipo);
    }

    // Filtro por valor
    if (filtroValor !== 'todos') {
      valesFiltrados = valesFiltrados.filter(vale => {
        const valor = Number(vale.valor);
        switch (filtroValor) {
          case 'alto': return valor >= 100000;
          case 'medio': return valor >= 30000 && valor < 100000;
          case 'bajo': return valor < 30000;
          default: return true;
        }
      });
    }

    // Filtro por peluquero
    if (filtroPeluquero !== 'todos') {
      const peluqueroSeleccionado = JSON.parse(filtroPeluquero);
      valesFiltrados = valesFiltrados.filter(vale => {
        const nombreVale = vale.peluqueroNombre || vale.peluquero || 'Sin nombre';
        const emailVale = vale.peluqueroEmail || '';
        return nombreVale === peluqueroSeleccionado.nombre && emailVale === peluqueroSeleccionado.email;
      });
    }

    // Filtro por fecha
    if (filtroFecha) {
      const fechaSeleccionada = new Date(filtroFecha);
      fechaSeleccionada.setHours(0, 0, 0, 0);
      const fechaSiguiente = new Date(fechaSeleccionada);
      fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
      
      valesFiltrados = valesFiltrados.filter(vale => {
        const fechaVale = new Date(vale.fecha);
        fechaVale.setHours(0, 0, 0, 0);
        return fechaVale >= fechaSeleccionada && fechaVale < fechaSiguiente;
      });
    }

    // Búsqueda por texto (solo en servicio/concepto ahora, peluquero tiene su propio filtro)
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      valesFiltrados = valesFiltrados.filter(vale =>
        (vale.servicio || vale.concepto || '').toLowerCase().includes(termino)
      );
    }

    // Ordenamiento
    const valesOrdenados = valesFiltrados.sort((a, b) => {
      if (ordenamiento === 'nuevo') {
        return b.fecha - a.fecha; // Más nuevo primero
      } else {
        return a.fecha - b.fecha; // Más antiguo primero
      }
    });
    setValesPendientes(valesOrdenados);
    
    // Mejorar la lógica de loading
    setLoading(false);
  }, [valesServicio, valesGasto, filtroTipo, filtroValor, busqueda, filtroPeluquero, filtroFecha, ordenamiento]);

  const handleAccionVale = (vale, accion) => {
    setValeActual(vale);
    setAccionModal(accion);
    setObservacion('');
    setFormaPago('');
    setLocal('');
    setDividirPorDos('100'); // reset selector
    setComisionExtra(Number(vale.comisionExtra) || 0); // Initialize with existing commission
    setShowModal(true);
  };

  const handleConfirmarAccion = async () => {
    if (!valeActual) return;
    if (!local) {
      setMensaje('Selecciona el local');
      return;
    }
    if (accionModal === 'aprobar' && !formaPago) {
      setMensaje('Selecciona la forma de pago');
      return;
    }
    try {
      await updateDoc(doc(db, valeActual.coleccion, valeActual.id), {
        estado: accionModal === 'aprobar' ? 'aprobado' : 'rechazado',
        aprobadoPor: user.email,
        observacion: observacion || '',
        local,
        ...(accionModal === 'aprobar' ? {
          formaPago,
          ...(valeActual.tipo === 'servicio' ? {
            dividirPorDos, // Guarda el porcentaje seleccionado
            comisionExtra: Number(comisionExtra) || 0
          } : {
            comisionExtra: Number(comisionExtra) || 0 // También para gastos
          })
        } : {})
      });
      setMensaje(accionModal === 'aprobar' ? '✅ Vale aprobado exitosamente' : '❌ Vale rechazado');
      setShowModal(false);
      setComisionExtra(0); // Reset commission
      setTimeout(() => setMensaje(''), 2000);
    } catch {
      setMensaje('❌ Error al actualizar el vale');
      setShowModal(false);
      setComisionExtra(0); // Reset commission on error too
      setTimeout(() => setMensaje(''), 2000);
    }
  };

  // Función para seleccionar/deseleccionar vales
  const toggleSeleccionVale = (valeId) => {
    setValesSeleccionados(prev => 
      prev.includes(valeId) 
        ? prev.filter(id => id !== valeId)
        : [...prev, valeId]
    );
  };

  // Función para seleccionar todos los vales
  const toggleSeleccionTodos = () => {
    if (valesSeleccionados.length === valesPendientes.length) {
      setValesSeleccionados([]);
    } else {
      setValesSeleccionados(valesPendientes.map(vale => vale.id));
    }
  };

  // Función para aprobación masiva
  const handleAprobacionMasiva = async () => {
    if (valesSeleccionados.length === 0) return;
    if (!local || !formaPago) {
      setMensaje('Completa todos los campos requeridos');
      return;
    }

    try {
      const promesas = valesSeleccionados.map(valeId => {
        const vale = valesPendientes.find(v => v.id === valeId);
        return updateDoc(doc(db, vale.coleccion, valeId), {
          estado: 'aprobado',
          aprobadoPor: user.email,
          observacion: observacion || '',
          local,
          formaPago,
          ...(vale.tipo === 'servicio' ? {
            dividirPorDos,
            comisionExtra: Number(vale.comisionExtra) || 0
          } : {})
        });
      });

      await Promise.all(promesas);
      setMensaje(`✅ ${valesSeleccionados.length} vales aprobados exitosamente`);
      setShowMasivo(false);
      setValesSeleccionados([]);
      setTimeout(() => setMensaje(''), 2000);
    } catch {
      setMensaje('❌ Error en la aprobación masiva');
      setShowMasivo(false);
      setTimeout(() => setMensaje(''), 2000);
    }
  };

  // Funciones para navegación de tarjetas
  const siguienteVale = () => {
    if (indiceActual < valesPendientes.length - 1) {
      setIndiceActual(prev => prev + 1);
    }
  };

  const anteriorVale = () => {
    if (indiceActual > 0) {
      setIndiceActual(prev => prev - 1);
    }
  };

  const irAVale = (indice) => {
    setIndiceActual(indice);
  };

  // Auto-ajustar índice si se filtra y no hay suficientes vales
  useEffect(() => {
    if (valesPendientes.length > 0 && indiceActual >= valesPendientes.length) {
      setIndiceActual(valesPendientes.length - 1);
    } else if (valesPendientes.length === 0) {
      setIndiceActual(0);
    }
  }, [valesPendientes.length, indiceActual]);

  // Calcular estadísticas
  const estadisticas = {
    total: valesPendientes.length,
    servicios: valesServicio.length,
    gastos: valesGasto.length,
    valorTotal: valesPendientes.reduce((sum, vale) => sum + Number(vale.valor), 0),
    valorServicios: valesServicio.reduce((sum, vale) => sum + Number(vale.valor), 0),
    valorGastos: valesGasto.reduce((sum, vale) => sum + Number(vale.valor), 0)
  };

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (rol !== 'admin' && rol !== 'anfitrion') {
    return <Alert variant="danger" className="mt-4 text-center">No tienes permisos para aprobar vales.</Alert>;
  }

  return (
    <>
      {/* Header moderno con gradiente */}
      <div style={{
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        borderRadius: '0 0 24px 24px',
        padding: '24px 16px',
        marginBottom: 24,
        color: 'white',
        boxShadow: '0 8px 24px rgba(139, 92, 246, 0.15)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ 
            margin: 0, 
            fontWeight: 700, 
            fontSize: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <i className="bi bi-shield-check" style={{ fontSize: '1.5rem' }}></i>
            Centro de Aprobaciones
          </h2>
          <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '1rem' }}>
            Gestiona y aprueba vales pendientes de forma eficiente
          </p>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <Row className="mb-4">
        <Col md={3} sm={6} className="mb-3">
          <Card style={{
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: 'white',
            height: '100%'
          }}>
            <Card.Body className="text-center">
              <i className="bi bi-clock-history" style={{ fontSize: '2rem', marginBottom: 8 }}></i>
              <h3 style={{ margin: 0, fontWeight: 700 }}>{estadisticas.total}</h3>
              <small style={{ opacity: 0.9 }}>Total Pendientes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card style={{
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            color: 'white',
            height: '100%'
          }}>
            <Card.Body className="text-center">
              <i className="bi bi-scissors" style={{ fontSize: '2rem', marginBottom: 8 }}></i>
              <h3 style={{ margin: 0, fontWeight: 700 }}>{estadisticas.servicios}</h3>
              <small style={{ opacity: 0.9 }}>Servicios</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card style={{
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            height: '100%'
          }}>
            <Card.Body className="text-center">
              <i className="bi bi-cash-coin" style={{ fontSize: '2rem', marginBottom: 8 }}></i>
              <h3 style={{ margin: 0, fontWeight: 700 }}>{estadisticas.gastos}</h3>
              <small style={{ opacity: 0.9 }}>Gastos</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card style={{
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            height: '100%'
          }}>
            <Card.Body className="text-center">
              <i className="bi bi-currency-dollar" style={{ fontSize: '2rem', marginBottom: 8 }}></i>
              <h3 style={{ margin: 0, fontWeight: 700 }}>
                ${estadisticas.valorTotal.toLocaleString()}
              </h3>
              <small style={{ opacity: 0.9 }}>Valor Total</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Controles de filtros y búsqueda */}
      <Card style={{ 
        border: 'none', 
        borderRadius: 16, 
        marginBottom: 24,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
      }}>
        <Card.Body>
          {/* Primera fila de filtros */}
          <Row className="align-items-end mb-3">
            <Col lg={2} md={3} sm={6} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-funnel me-2"></i>Tipo
              </Form.Label>
              <Form.Select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                style={{ borderRadius: 12 }}
              >
                <option value="todos">Todos los tipos</option>
                <option value="servicio">Solo Servicios</option>
                <option value="gasto">Solo Gastos</option>
              </Form.Select>
            </Col>
            <Col lg={2} md={3} sm={6} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-cash me-2"></i>Valor
              </Form.Label>
              <Form.Select
                value={filtroValor}
                onChange={(e) => setFiltroValor(e.target.value)}
                style={{ borderRadius: 12 }}
              >
                <option value="todos">Todos los valores</option>
                <option value="alto">Alto (+$100k)</option>
                <option value="medio">Medio ($30k-$100k)</option>
                <option value="bajo">Bajo (-$30k)</option>
              </Form.Select>
            </Col>
            <Col lg={3} md={4} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-person me-2"></i>Peluquero
              </Form.Label>
              <Form.Select
                value={filtroPeluquero}
                onChange={(e) => setFiltroPeluquero(e.target.value)}
                style={{ borderRadius: 12 }}
              >
                <option value="todos">Todos los peluqueros</option>
                {peluquerosUnicos.map((peluquero, index) => (
                  <option 
                    key={index} 
                    value={JSON.stringify(peluquero)}
                  >
                    {peluquero.nombre} {peluquero.email && `(${peluquero.email})`}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col lg={2} md={3} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-calendar me-2"></i>Fecha
              </Form.Label>
              <Form.Control
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                style={{ borderRadius: 12 }}
              />
            </Col>
            <Col lg={2} md={3} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-sort-down me-2"></i>Orden
              </Form.Label>
              <Form.Select
                value={ordenamiento}
                onChange={(e) => setOrdenamiento(e.target.value)}
                style={{ borderRadius: 12 }}
              >
                <option value="nuevo">Más nuevo</option>
                <option value="antiguo">Más antiguo</option>
              </Form.Select>
            </Col>
            <Col lg={1} className="mb-3">
              {filtroFecha && (
                <Button
                  variant="outline-secondary"
                  onClick={() => setFiltroFecha('')}
                  style={{ borderRadius: 12, padding: '6px 12px' }}
                  title="Limpiar filtro de fecha"
                >
                  <i className="bi bi-x-lg"></i>
                </Button>
              )}
            </Col>
          </Row>

          {/* Segunda fila: Búsqueda y acciones */}
          <Row className="align-items-end">
            <Col md={6} className="mb-3">
              <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                <i className="bi bi-search me-2"></i>Búsqueda por servicio/concepto
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Buscar por servicio o concepto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ borderRadius: 12 }}
              />
            </Col>
            <Col md={4} className="mb-3">
              {(filtroTipo !== 'todos' || filtroValor !== 'todos' || filtroPeluquero !== 'todos' || filtroFecha || busqueda) && (
                <Button
                  variant="outline-warning"
                  onClick={() => {
                    setFiltroTipo('todos');
                    setFiltroValor('todos');
                    setFiltroPeluquero('todos');
                    setFiltroFecha('');
                    setBusqueda('');
                    setOrdenamiento('nuevo');
                  }}
                  style={{ borderRadius: 12, fontWeight: 600, width: '100%' }}
                >
                  <i className="bi bi-arrow-counterclockwise me-2"></i>
                  Limpiar Filtros
                </Button>
              )}
            </Col>
            <Col md={2} className="mb-3">
              <div className="d-flex gap-2">
                {valesSeleccionados.length > 0 && (
                  <Button
                    variant="success"
                    onClick={() => setShowMasivo(true)}
                    style={{
                      borderRadius: 12,
                      fontWeight: 600,
                      width: '100%'
                    }}
                  >
                    <i className="bi bi-check-all me-2"></i>
                    Masivo ({valesSeleccionados.length})
                  </Button>
                )}
                {valesPendientes.length > 0 && (
                  <Button
                    className="d-md-none" // Solo mostrar en móvil
                    variant={modoTarjeta ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      setModoTarjeta(!modoTarjeta);
                    }}
                    style={{
                      borderRadius: 12,
                      fontWeight: 600,
                      padding: '8px 16px',
                      minWidth: '120px'
                    }}
                    title={modoTarjeta ? 'Cambiar a vista tabla' : 'Cambiar a vista tarjetas'}
                  >
                    <i className={`bi ${modoTarjeta ? 'bi-table' : 'bi-credit-card-2-front'} me-2`}></i>
                    {modoTarjeta ? 'Tabla' : 'Tarjetas'}
                  </Button>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Mensaje de notificación mejorado */}
      {mensaje && (
        <Alert 
          variant={mensaje.includes('✅') ? 'success' : 'danger'}
          style={{
            borderRadius: 16,
            border: 'none',
            fontWeight: 600,
            marginBottom: 24
          }}
        >
          {mensaje}
        </Alert>
      )}

      {/* Tabla principal mejorada */}
      <Card style={{ 
        border: 'none', 
        borderRadius: 16,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
      }}>
        <Card.Header style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          border: 'none',
          borderRadius: '16px 16px 0 0',
          padding: '20px 24px'
        }}>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
                <i className="bi bi-list-check me-2"></i>
                Vales Pendientes ({valesPendientes.length})
              </h5>
              {/* Indicadores de filtros activos */}
              <div className="d-flex gap-2 mt-2">
                {filtroTipo !== 'todos' && (
                  <Badge bg="info" style={{ borderRadius: 8 }}>
                    Tipo: {filtroTipo === 'servicio' ? 'Servicios' : 'Gastos'}
                  </Badge>
                )}
                {filtroValor !== 'todos' && (
                  <Badge bg="info" style={{ borderRadius: 8 }}>
                    Valor: {filtroValor}
                  </Badge>
                )}
                {filtroPeluquero !== 'todos' && (
                  <Badge bg="info" style={{ borderRadius: 8 }}>
                    Peluquero: {JSON.parse(filtroPeluquero).nombre}
                  </Badge>
                )}
                {filtroFecha && (
                  <Badge bg="info" style={{ borderRadius: 8 }}>
                    Fecha: {new Date(filtroFecha).toLocaleDateString()}
                  </Badge>
                )}
                {busqueda && (
                  <Badge bg="info" style={{ borderRadius: 8 }}>
                    Búsqueda: "{busqueda}"
                  </Badge>
                )}
                {ordenamiento !== 'nuevo' && (
                  <Badge bg="secondary" style={{ borderRadius: 8 }}>
                    Orden: Más antiguo
                  </Badge>
                )}
              </div>
            </div>
            {valesPendientes.length > 0 && (
              <Form.Check
                type="checkbox"
                label="Seleccionar todos"
                checked={valesSeleccionados.length === valesPendientes.length}
                onChange={toggleSeleccionTodos}
                style={{ fontWeight: 600 }}
              />
            )}
          </div>
        </Card.Header>
        <Card.Body style={{ padding: 0 }}>
          {valesPendientes.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <i className="bi bi-check-circle" style={{ fontSize: '3rem', marginBottom: 16 }}></i>
              <h5>¡Excelente trabajo!</h5>
              <p>No hay vales pendientes por aprobar</p>
            </div>
          ) : (
            <>
              {/* Vista de tabla tradicional - Siempre visible en desktop */}
              <div className="d-none d-md-block" style={{ overflowX: 'auto' }}>
                <Table hover className="mb-0">
                  <thead style={{
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <tr>
                      <th style={{ border: 'none', padding: '16px', fontWeight: 600 }}>
                        <Form.Check 
                          type="checkbox"
                          style={{ margin: 0 }}
                        />
                      </th>
                      <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Fecha</th>
                      <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Tipo</th>
                      <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Concepto</th>
                      <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Valor</th>
                      <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Profesional</th>
                      <th style={{ border: 'none', padding: '16px', fontWeight: 600, color: '#374151' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valesPendientes.map((vale, index) => (
                      <tr key={vale.id} style={{
                        borderBottom: index === valesPendientes.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'all 0.2s',
                      }}>
                        <td style={{ border: 'none', padding: '16px' }}>
                          <Form.Check
                            type="checkbox"
                            checked={valesSeleccionados.includes(vale.id)}
                            onChange={() => toggleSeleccionVale(vale.id)}
                          />
                        </td>
                        <td style={{ border: 'none', padding: '16px' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {vale.fecha.toLocaleDateString()}
                            </div>
                            <small style={{ color: '#64748b' }}>
                              {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>
                        </td>
                        <td style={{ border: 'none', padding: '16px' }}>
                          <Badge 
                            bg={vale.tipo === 'servicio' ? 'primary' : 'danger'}
                            style={{
                              borderRadius: 12,
                              padding: '8px 12px',
                              fontWeight: 600
                            }}
                          >
                            <i className={`bi ${vale.tipo === 'servicio' ? 'bi-scissors' : 'bi-cash-coin'} me-1`}></i>
                            {vale.tipo === 'servicio' ? 'Servicio' : 'Gasto'}
                          </Badge>
                        </td>
                        <td style={{ border: 'none', padding: '16px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {vale.servicio || vale.concepto || '-'}
                          </div>
                          {vale.descripcion && (
                            <small style={{ color: '#64748b' }}>{vale.descripcion}</small>
                          )}
                        </td>
                        <td style={{ border: 'none', padding: '16px' }}>
                          <div style={{
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            color: vale.tipo === 'servicio' ? '#16a34a' : '#ef4444'
                          }}>
                            ${Number(vale.valor).toLocaleString()}
                          </div>
                          {vale.comisionExtra && Number(vale.comisionExtra) > 0 && (
                            <small style={{ color: '#059669' }}>
                              +${Number(vale.comisionExtra).toLocaleString()} extra
                            </small>
                          )}
                        </td>
                        <td style={{ border: 'none', padding: '16px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {vale.peluqueroNombre || vale.peluquero || 'Profesional'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {vale.peluqueroEmail}
                          </div>
                          {vale.cliente && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                              Cliente: {vale.cliente}
                            </div>
                          )}
                        </td>
                        <td style={{ border: 'none', padding: '16px' }}>
                          <ButtonGroup size="sm">
                            <Button
                              variant="outline-success"
                              onClick={() => handleAccionVale(vale, 'aprobar')}
                              style={{
                                borderRadius: '8px 0 0 8px',
                                fontWeight: 600,
                                border: '2px solid #16a34a',
                                color: '#16a34a'
                              }}
                            >
                              <i className="bi bi-check-lg"></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              onClick={() => handleAccionVale(vale, 'rechazar')}
                              style={{
                                borderRadius: '0 8px 8px 0',
                                fontWeight: 600,
                                border: '2px solid #ef4444',
                                borderLeft: 'none',
                                color: '#ef4444'
                              }}
                            >
                              <i className="bi bi-x-lg"></i>
                            </Button>
                          </ButtonGroup>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Vista móvil condicional */}
              <div className="d-md-none">
                {modoTarjeta ? (
                  /* Vista de tarjeta individual - Solo en móvil */
                  <div style={{ padding: '24px' }}>
                    {(() => {
                      const valeActual = valesPendientes[indiceActual];
                      if (!valeActual) return null;
                      
                      return (
                        <>
                          {/* Navegación superior */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 24,
                            padding: '16px 20px',
                            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                            borderRadius: 16,
                            border: '1px solid #e2e8f0'
                          }}>
                            <Button
                              variant="outline-secondary"
                              onClick={anteriorVale}
                              disabled={indiceActual === 0}
                              style={{ borderRadius: 12, padding: '8px 16px' }}
                            >
                              <i className="bi bi-chevron-left me-2"></i>
                              Anterior
                            </Button>
                            
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                                Vale {indiceActual + 1} de {valesPendientes.length}
                              </div>
                              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                                Desliza para aprobar rápidamente
                              </div>
                            </div>
                            
                            <Button
                              variant="outline-secondary"
                              onClick={siguienteVale}
                              disabled={indiceActual === valesPendientes.length - 1}
                              style={{ borderRadius: 12, padding: '8px 16px' }}
                            >
                              Siguiente
                              <i className="bi bi-chevron-right ms-2"></i>
                            </Button>
                          </div>

                          {/* Indicadores de progreso */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 4,
                            marginBottom: 24
                          }}>
                            {valesPendientes.slice(0, Math.min(10, valesPendientes.length)).map((_, index) => (
                              <button
                                key={index}
                                onClick={() => irAVale(index)}
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: index === indiceActual ? '#8b5cf6' : '#e2e8f0',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                              />
                            ))}
                            {valesPendientes.length > 10 && (
                              <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 8 }}>
                                +{valesPendientes.length - 10} más
                              </span>
                            )}
                          </div>

                          {/* Tarjeta principal - Más compacta */}
                          <Card style={{
                            border: `2px solid ${valeActual.tipo === 'servicio' ? '#8b5cf6' : '#ef4444'}`,
                            borderRadius: 16,
                            background: 'white',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            overflow: 'hidden',
                            maxWidth: 400,
                            margin: '0 auto'
                          }}>
                            {/* Header compacto */}
                            <div style={{
                              background: valeActual.tipo === 'servicio' 
                                ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              color: 'white',
                              padding: '16px',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>
                                <i className={`bi ${valeActual.tipo === 'servicio' ? 'bi-scissors' : 'bi-cash-coin'} me-2`}></i>
                                {valeActual.tipo === 'servicio' ? 'Vale de Servicio' : 'Vale de Gasto'}
                              </div>
                              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                {valeActual.fecha.toLocaleDateString()} - {valeActual.fecha.toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>

                            <Card.Body style={{ padding: '20px' }}>
                              {/* Información del profesional - Prioritaria */}
                              <div style={{
                                background: '#f8fafc',
                                padding: '12px',
                                borderRadius: 12,
                                marginBottom: 16,
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12
                              }}>
                                <div style={{
                                  width: 40,
                                  height: 40,
                                  background: valeActual.tipo === 'servicio' ? '#8b5cf6' : '#ef4444',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '1.2rem'
                                }}>
                                  <i className="bi bi-person"></i>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>
                                    {valeActual.peluqueroNombre || valeActual.peluquero || 'Profesional'}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    {valeActual.peluqueroEmail}
                                  </div>
                                </div>
                              </div>

                              {/* Concepto y valor en layout vertical compacto */}
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ 
                                  fontSize: '1.1rem', 
                                  fontWeight: 600, 
                                  color: '#1e293b',
                                  marginBottom: 8,
                                  textAlign: 'center'
                                }}>
                                  {valeActual.servicio || valeActual.concepto || 'Sin descripción'}
                                </div>
                                
                                {/* Valor destacado compacto */}
                                <div style={{
                                  background: valeActual.tipo === 'servicio' 
                                    ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                                    : 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                                  padding: '12px',
                                  borderRadius: 12,
                                  textAlign: 'center',
                                  border: valeActual.tipo === 'servicio' 
                                    ? '2px solid #22c55e'
                                    : '2px solid #ef4444'
                                }}>
                                  <div style={{
                                    fontSize: '1.8rem',
                                    fontWeight: 800,
                                    color: valeActual.tipo === 'servicio' ? '#15803d' : '#dc2626',
                                    marginBottom: 4
                                  }}>
                                    ${Number(valeActual.valor).toLocaleString()}
                                  </div>
                                  {valeActual.comisionExtra && Number(valeActual.comisionExtra) > 0 && (
                                    <div style={{ 
                                      fontSize: '0.85rem', 
                                      color: '#059669',
                                      fontWeight: 600
                                    }}>
                                      +${Number(valeActual.comisionExtra).toLocaleString()} extra
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Cliente si existe */}
                              {valeActual.cliente && (
                                <div style={{
                                  background: 'white',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  marginBottom: 16
                                }}>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 2 }}>
                                    Cliente:
                                  </div>
                                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                                    {valeActual.cliente}
                                  </div>
                                </div>
                              )}

                              {/* Botones de acción apilados verticalmente */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Button
                                  variant="success"
                                  onClick={() => handleAccionVale(valeActual, 'aprobar')}
                                  style={{
                                    borderRadius: 12,
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    width: '100%',
                                    padding: '10px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                                  }}
                                >
                                  <i className="bi bi-check-circle me-2"></i>
                                  Aprobar
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => handleAccionVale(valeActual, 'rechazar')}
                                  style={{
                                    borderRadius: 12,
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    width: '100%',
                                    padding: '10px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                                  }}
                                >
                                  <i className="bi bi-x-circle me-2"></i>
                                  Rechazar
                                </Button>
                              </div>
                            </Card.Body>
                          </Card>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  /* Vista de tabla simplificada para móvil cuando no está en modo tarjeta */
                  <div style={{ overflowX: 'auto' }}>
                    <Table hover className="mb-0">
                      <thead style={{
                        background: '#f8fafc',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <tr>
                          <th style={{ border: 'none', padding: '12px', fontWeight: 600, fontSize: '0.9rem' }}>Vale</th>
                          <th style={{ border: 'none', padding: '12px', fontWeight: 600, fontSize: '0.9rem' }}>Valor</th>
                          <th style={{ border: 'none', padding: '12px', fontWeight: 600, fontSize: '0.9rem' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valesPendientes.map((vale, index) => (
                          <tr key={vale.id} style={{
                            borderBottom: index === valesPendientes.length - 1 ? 'none' : '1px solid #f1f5f9',
                          }}>
                            <td style={{ border: 'none', padding: '12px' }}>
                              <div>
                                <Badge 
                                  bg={vale.tipo === 'servicio' ? 'primary' : 'danger'}
                                  style={{ borderRadius: 8, fontSize: '0.7rem', marginBottom: 4 }}
                                >
                                  {vale.tipo === 'servicio' ? 'Servicio' : 'Gasto'}
                                </Badge>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                                  {vale.servicio || vale.concepto || '-'}
                                </div>
                                <small style={{ color: '#64748b' }}>
                                  {vale.peluqueroNombre || vale.peluquero || 'Profesional'} - {vale.peluqueroEmail}
                                </small>
                              </div>
                            </td>
                            <td style={{ border: 'none', padding: '12px' }}>
                              <div style={{
                                fontWeight: 700,
                                fontSize: '1rem',
                                color: vale.tipo === 'servicio' ? '#16a34a' : '#ef4444'
                              }}>
                                ${Number(vale.valor).toLocaleString()}
                              </div>
                            </td>
                            <td style={{ border: 'none', padding: '12px' }}>
                              <div className="d-flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline-success"
                                  onClick={() => handleAccionVale(vale, 'aprobar')}
                                  style={{
                                    borderRadius: 8,
                                    padding: '4px 8px',
                                    border: '1px solid #16a34a'
                                  }}
                                >
                                  <i className="bi bi-check"></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => handleAccionVale(vale, 'rechazar')}
                                  style={{
                                    borderRadius: 8,
                                    padding: '4px 8px',
                                    border: '1px solid #ef4444'
                                  }}
                                >
                                  <i className="bi bi-x"></i>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Modal de aprobación masiva */}
      <Modal show={showMasivo} onHide={() => setShowMasivo(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '2px solid #f1f5f9' }}>
          <Modal.Title style={{ color: '#1e293b', fontWeight: 700 }}>
            <i className="bi bi-check-all me-2" style={{ color: '#16a34a' }}></i>
            Aprobación Masiva
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" style={{ borderRadius: 12 }}>
            <i className="bi bi-info-circle me-2"></i>
            Se aprobarán <strong>{valesSeleccionados.length} vales</strong> con la configuración seleccionada.
          </Alert>
          
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Local <span style={{color:'red'}}>*</span></Form.Label>
            <Form.Select
              value={local}
              onChange={e => setLocal(e.target.value)}
              style={{ borderRadius: 12 }}
              required
            >
              <option value="">Selecciona un local</option>
              <option value="La Tirana">La Tirana</option>
              <option value="Salvador Allende">Salvador Allende</option>
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Forma de Pago <span style={{color:'red'}}>*</span></Form.Label>
            <Form.Select
              value={formaPago}
              onChange={e => setFormaPago(e.target.value)}
              style={{ borderRadius: 12 }}
              required
            >
              <option value="">Selecciona forma de pago</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Observación (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Agrega una observación..."
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              style={{ borderRadius: 12 }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '2px solid #f1f5f9' }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowMasivo(false)}
            style={{ borderRadius: 12 }}
          >
            Cancelar
          </Button>
          <Button 
            variant="success" 
            onClick={handleAprobacionMasiva}
            style={{ borderRadius: 12, fontWeight: 600 }}
          >
            <i className="bi bi-check-all me-2"></i>
            Aprobar {valesSeleccionados.length} Vales
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal individual mejorado */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '2px solid #f1f5f9' }}>
          <Modal.Title style={{ 
            color: accionModal === 'aprobar' ? '#16a34a' : '#ef4444',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <i className={`bi ${accionModal === 'aprobar' ? 'bi-check-circle' : 'bi-x-circle'}`}></i>
            {accionModal === 'aprobar' ? 'Aprobar Vale' : 'Rechazar Vale'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {valeActual && (
            <Alert 
              variant={accionModal === 'aprobar' ? 'success' : 'warning'} 
              style={{ borderRadius: 12, marginBottom: 20 }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                <i className={`bi ${valeActual.tipo === 'servicio' ? 'bi-scissors' : 'bi-cash-coin'} me-2`}></i>
                {valeActual.tipo === 'servicio' ? 'Vale de Servicio' : 'Vale de Gasto'}
              </div>
              <div><strong>Concepto:</strong> {valeActual.servicio || valeActual.concepto}</div>
              <div><strong>Valor:</strong> ${Number(valeActual.valor).toLocaleString()}</div>
              <div><strong>Profesional:</strong> {valeActual.peluqueroNombre || valeActual.peluquero || 'Profesional'} ({valeActual.peluqueroEmail})</div>
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Local <span style={{color:'red'}}>*</span></Form.Label>
            <Form.Select
              value={local}
              onChange={e => setLocal(e.target.value)}
              style={{ borderRadius: 12 }}
              required
            >
              <option value="">Selecciona un local</option>
              <option value="La Tirana">La Tirana</option>
              <option value="Salvador Allende">Salvador Allende</option>
            </Form.Select>
          </Form.Group>

          {accionModal === 'aprobar' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontWeight: 600 }}>Forma de Pago <span style={{color:'red'}}>*</span></Form.Label>
                <Form.Select
                  value={formaPago}
                  onChange={e => setFormaPago(e.target.value)}
                  style={{ borderRadius: 12 }}
                  required
                >
                  <option value="">Selecciona una opción</option>
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="debito">💳 Débito</option>
                  <option value="transferencia">🏦 Transferencia</option>
                </Form.Select>
              </Form.Group>
              
              {valeActual && valeActual.tipo === 'servicio' && (
                <Card style={{ 
                  border: '2px solid #e5e7eb', 
                  borderRadius: 12, 
                  background: '#f8fafc',
                  marginBottom: 16
                }}>
                  <Card.Body>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, color: '#374151' }}>
                        <i className="bi bi-pie-chart me-2"></i>
                        Distribución del Monto
                      </Form.Label>
                      <Form.Select
                        value={dividirPorDos}
                        onChange={e => setDividirPorDos(e.target.value)}
                        style={{ borderRadius: 12 }}
                      >
                        <option value="100">🎯 No dividir (100% para el peluquero)</option>
                        <option value="50">⚖️ Dividir 50/50 (50% peluquero, 50% empresa)</option>
                        <option value="45">📊 Dividir 45/55 (45% peluquero, 55% empresa)</option>
                      </Form.Select>
                    </Form.Group>
                    
                    {dividirPorDos !== '100' && (
                      <Alert variant="info" style={{ borderRadius: 12, margin: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          💰 Distribución del vale:
                        </div>
                        <div>
                          👤 Peluquero: <strong>{dividirPorDos}%</strong> = ${((Number(valeActual.valor) * Number(dividirPorDos)) / 100).toLocaleString()}
                        </div>
                        <div>
                          🏢 Empresa: <strong>{100 - Number(dividirPorDos)}%</strong> = ${((Number(valeActual.valor) * (100 - Number(dividirPorDos))) / 100).toLocaleString()}
                        </div>
                      </Alert>
                    )}
                  </Card.Body>
                </Card>
              )}

              {/* Sección para agregar/editar comisión extra */}
              {valeActual && (
                <Card style={{ 
                  border: '2px solid #f59e0b', 
                  borderRadius: 12, 
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                  marginBottom: 16
                }}>
                  <Card.Body>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <i className="bi bi-cash-stack"></i>
                        💰 Propina Extra (Opcional)
                      </Form.Label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 600, color: '#374151', fontSize: '1.2rem' }}>$</span>
                        <Form.Control
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="0"
                          value={comisionExtra}
                          onChange={(e) => setComisionExtra(Number(e.target.value) || 0)}
                          style={{ 
                            borderRadius: 12, 
                            border: '2px solid #f59e0b',
                            fontSize: '1.1rem',
                            fontWeight: 600
                          }}
                        />
                      </div>
                      <Form.Text style={{ color: '#92400e', fontWeight: 500 }}>
                        {valeActual.tipo === 'servicio' 
                          ? 'Esta propina va 100% al peluquero, adicional a su comisión por porcentaje'
                          : 'Esta propina va 100% al peluquero, adicional al vale de gasto'
                        }
                      </Form.Text>
                    </Form.Group>
                    
                    {comisionExtra > 0 && (
                      <Alert variant="warning" style={{ borderRadius: 12, margin: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          🎯 Resumen total para el peluquero:
                        </div>
                        {valeActual.tipo === 'servicio' ? (
                          <>
                            <div>
                              💼 Comisión por porcentaje: <strong>${((Number(valeActual.valor) * Number(dividirPorDos)) / 100).toLocaleString()}</strong>
                            </div>
                            <div>
                              💰 Propina extra: <strong>+${Number(comisionExtra).toLocaleString()}</strong>
                            </div>
                            <hr style={{ margin: '8px 0', borderColor: '#f59e0b' }} />
                            <div style={{ fontSize: '1.1rem' }}>
                              🏆 <strong>Total peluquero: ${(((Number(valeActual.valor) * Number(dividirPorDos)) / 100) + Number(comisionExtra)).toLocaleString()}</strong>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              📋 Vale de gasto: <strong>${Number(valeActual.valor).toLocaleString()}</strong>
                            </div>
                            <div>
                              💰 Propina extra: <strong>+${Number(comisionExtra).toLocaleString()}</strong>
                            </div>
                            <hr style={{ margin: '8px 0', borderColor: '#f59e0b' }} />
                            <div style={{ fontSize: '1.1rem' }}>
                              🏆 <strong>Total peluquero: ${(Number(valeActual.valor) + Number(comisionExtra)).toLocaleString()}</strong>
                            </div>
                          </>
                        )}
                      </Alert>
                    )}
                  </Card.Body>
                </Card>
              )}
            </>
          )}

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>
              Observación {accionModal === 'rechazar' ? <span style={{color:'red'}}>*</span> : '(opcional)'}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder={accionModal === 'aprobar' 
                ? "Agrega una observación opcional..." 
                : "Explica el motivo del rechazo..."
              }
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              style={{ borderRadius: 12 }}
              required={accionModal === 'rechazar'}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '2px solid #f1f5f9' }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowModal(false)}
            style={{ borderRadius: 12 }}
          >
            Cancelar
          </Button>
          <Button 
            variant={accionModal === 'aprobar' ? 'success' : 'danger'}
            onClick={handleConfirmarAccion}
            style={{ borderRadius: 12, fontWeight: 600 }}
          >
            <i className={`bi ${accionModal === 'aprobar' ? 'bi-check-lg' : 'bi-x-lg'} me-2`}></i>
            {accionModal === 'aprobar' ? 'Aprobar Vale' : 'Rechazar Vale'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default AprobarValesServicio;