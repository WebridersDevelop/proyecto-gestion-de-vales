import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, Row, Col, Spinner, Alert, Form, Button } from 'react-bootstrap';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart, BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

Chart.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

function Dashboard() {
  const { rol, loading } = useAuth();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState('');
  const [usuarios, setUsuarios] = useState({});
  const [tipoFiltro, setTipoFiltro] = useState('predefinido'); // 'predefinido' o 'personalizado'
  const [filtroFecha, setFiltroFecha] = useState('7'); // Para filtros predefinidos
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tiempoActual, setTiempoActual] = useState(new Date());

  // Actualizar tiempo cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTiempoActual(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        
        // Obtener usuarios
        const usuariosSnap = await getDocs(collection(db, 'usuarios'));
        const usuariosMap = {};
        usuariosSnap.forEach(doc => {
          const data = doc.data();
          usuariosMap[data.email] = data.nombre || data.email;
        });
        setUsuarios(usuariosMap);

        // Calcular fechas según filtro
        let fechaLimiteInicio, fechaLimiteFin;
        
        if (tipoFiltro === 'personalizado' && fechaInicio && fechaFin) {
          fechaLimiteInicio = new Date(fechaInicio);
          fechaLimiteFin = new Date(fechaFin);
          fechaLimiteFin.setHours(23, 59, 59, 999);
        } else {
          const ahora = new Date();
          fechaLimiteFin = new Date(ahora);
          fechaLimiteInicio = new Date();
          fechaLimiteInicio.setDate(ahora.getDate() - parseInt(filtroFecha));
        }

        const valesServicioSnap = await getDocs(collection(db, 'vales_servicio'));
        const valesGastoSnap = await getDocs(collection(db, 'vales_gasto'));

        // Métricas principales
        let ingresosTotales = 0;
        let gastosTotales = 0;
        let gananciaReal = 0;
        let valesAprobados = 0;
        let valesPendientes = 0;
        let valesRechazados = 0;
        let statsPorUsuario = {};
        let ventasPorDia = {};

        // Estadísticas del día actual
        const hoy = new Date().toISOString().slice(0, 10);
        let estadisticasHoy = {
          ingresos: 0,
          egresos: 0,
          valesServicio: { aprobados: 0, pendientes: 0, rechazados: 0 },
          valesGasto: { aprobados: 0, pendientes: 0, rechazados: 0 },
          gananciaReal: 0,
          profesionalesActivos: new Set()
        };

        // Procesar vales de servicio
        valesServicioSnap.forEach(doc => {
          const data = doc.data();
          const fechaVale = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
          const fechaStr = fechaVale.toLocaleDateString('es-ES');
          const fechaStrISO = fechaVale.toISOString().slice(0, 10);
          
          // Procesar para rango seleccionado
          if (fechaVale >= fechaLimiteInicio && fechaVale <= fechaLimiteFin) {
            const valor = Number(data.valor) || 0;
            
            // Conteo por estado
            if (data.estado === 'aprobado') {
              ingresosTotales += valor;
              valesAprobados++;
              
              // Calcular ganancia real
              let porcentajeProfesional = 100;
              if (data.dividirPorDos) {
                if (typeof data.dividirPorDos === 'string') {
                  porcentajeProfesional = Number(data.dividirPorDos);
                } else if (data.dividirPorDos === true) {
                  porcentajeProfesional = 50;
                }
              }
              const base = (valor * porcentajeProfesional) / 100;
              gananciaReal += base + (Number(data.comisionExtra) || 0);
              
              // Ventas por día
              if (!ventasPorDia[fechaStr]) {
                ventasPorDia[fechaStr] = 0;
              }
              ventasPorDia[fechaStr] += valor;
            } else if (data.estado === 'pendiente') {
              valesPendientes++;
            } else if (data.estado === 'rechazado') {
              valesRechazados++;
            }

            // Stats por profesional
            const usuario = data.peluqueroEmail || 'Desconocido';
            const nombreUsuario = usuariosMap[usuario] || usuario;
            
            if (!statsPorUsuario[nombreUsuario]) {
              statsPorUsuario[nombreUsuario] = { 
                ingresos: 0, 
                vales: 0, 
                aprobados: 0,
                pendientes: 0
              };
            }
            
            statsPorUsuario[nombreUsuario].vales += 1;
            if (data.estado === 'aprobado') {
              statsPorUsuario[nombreUsuario].ingresos += valor;
              statsPorUsuario[nombreUsuario].aprobados += 1;
            } else if (data.estado === 'pendiente') {
              statsPorUsuario[nombreUsuario].pendientes += 1;
            }
          }

          // Procesar estadísticas del día actual
          if (fechaStrISO === hoy) {
            const valor = Number(data.valor) || 0;
            
            if (data.estado === 'aprobado') {
              estadisticasHoy.ingresos += valor;
              estadisticasHoy.valesServicio.aprobados++;
              
              // Ganancia real del día
              let porcentajeProfesional = 100;
              if (data.dividirPorDos) {
                if (typeof data.dividirPorDos === 'string') {
                  porcentajeProfesional = Number(data.dividirPorDos);
                } else if (data.dividirPorDos === true) {
                  porcentajeProfesional = 50;
                }
              }
              const base = (valor * porcentajeProfesional) / 100;
              estadisticasHoy.gananciaReal += base + (Number(data.comisionExtra) || 0);
            } else if (data.estado === 'rechazado') {
              estadisticasHoy.valesServicio.rechazados++;
            } else {
              estadisticasHoy.valesServicio.pendientes++;
            }
            
            if (data.peluqueroEmail) {
              estadisticasHoy.profesionalesActivos.add(data.peluqueroEmail);
            }
          }
        });

        // Procesar vales de gasto
        valesGastoSnap.forEach(doc => {
          const data = doc.data();
          const fechaVale = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
          const fechaStrISO = fechaVale.toISOString().slice(0, 10);
          
          if (fechaVale >= fechaLimiteInicio && fechaVale <= fechaLimiteFin && data.estado === 'aprobado') {
            gastosTotales += Number(data.valor) || 0;
          }

          // Gastos del día actual
          if (fechaStrISO === hoy) {
            const valor = Number(data.valor) || 0;
            
            if (data.estado === 'aprobado') {
              estadisticasHoy.egresos += valor;
              estadisticasHoy.valesGasto.aprobados++;
            } else if (data.estado === 'rechazado') {
              estadisticasHoy.valesGasto.rechazados++;
            } else {
              estadisticasHoy.valesGasto.pendientes++;
            }
            
            if (data.peluqueroEmail) {
              estadisticasHoy.profesionalesActivos.add(data.peluqueroEmail);
            }
          }
        });

        // Top 5 profesionales
        const topProfesionales = Object.entries(statsPorUsuario)
          .filter(([_, stats]) => stats.aprobados > 0)
          .sort((a, b) => b[1].ingresos - a[1].ingresos)
          .slice(0, 5);

        // Preparar datos para gráficos - asegurar que siempre hay datos
        const ventasDiarias = Object.entries(ventasPorDia).length > 0 
          ? Object.entries(ventasPorDia)
              .sort((a, b) => new Date(a[0].split('/').reverse().join('-')) - new Date(b[0].split('/').reverse().join('-')))
              .slice(-7)
          : [];

        // Si no hay ventas diarias, crear datos vacíos para el gráfico
        if (ventasDiarias.length === 0) {
          // Crear al menos 7 días de datos vacíos para mostrar el gráfico
          for (let i = 6; i >= 0; i--) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            ventasDiarias.push([fecha.toLocaleDateString('es-ES'), 0]);
          }
        }

        // Convertir Set a número
        estadisticasHoy.profesionalesActivos = estadisticasHoy.profesionalesActivos.size;

        console.log('Datos del período:', {
          fechaInicio: fechaLimiteInicio.toISOString().slice(0, 10),
          fechaFin: fechaLimiteFin.toISOString().slice(0, 10),
          tipoFiltro,
          filtroFecha,
          ingresosTotales,
          gastosTotales,
          totalVales: valesAprobados + valesPendientes + valesRechazados,
          ventasDiarias: ventasDiarias.length
        });

        setStats({
          ingresosTotales,
          gastosTotales,
          gananciaReal,
          utilidadNeta: gananciaReal - gastosTotales,
          margen: gananciaReal - gastosTotales,
          valesAprobados,
          valesPendientes,
          valesRechazados,
          totalVales: valesAprobados + valesPendientes + valesRechazados,
          topProfesionales,
          ventasDiarias,
          statsPorUsuario,
          promedioVale: valesAprobados > 0 ? ingresosTotales / valesAprobados : 0,
          rangoFechas: {
            inicio: fechaLimiteInicio.toISOString().slice(0, 10),
            fin: fechaLimiteFin.toISOString().slice(0, 10),
            dias: Math.ceil((fechaLimiteFin - fechaLimiteInicio) / (1000 * 60 * 60 * 24))
          },
          hoy: {
            fecha: hoy,
            ...estadisticasHoy,
            margenDia: estadisticasHoy.gananciaReal - estadisticasHoy.egresos,
            totalValesDia: estadisticasHoy.valesServicio.aprobados + estadisticasHoy.valesServicio.pendientes + 
                          estadisticasHoy.valesServicio.rechazados + estadisticasHoy.valesGasto.aprobados + 
                          estadisticasHoy.valesGasto.pendientes + estadisticasHoy.valesGasto.rechazados
          }
        });

      } catch (err) {
        console.error(err);
        setError('Error al cargar estadísticas');
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [tipoFiltro, filtroFecha, fechaInicio, fechaFin]);

  // Función para manejar cambio de tipo de filtro
  const handleTipoFiltroChange = (tipo) => {
    setTipoFiltro(tipo);
    if (tipo === 'predefinido') {
      setFechaInicio('');
      setFechaFin('');
    } else {
      // Establecer fechas por defecto para rango personalizado
      const hoy = new Date();
      const haceUnaSemana = new Date();
      haceUnaSemana.setDate(hoy.getDate() - 7);
      
      setFechaFin(hoy.toISOString().slice(0, 10));
      setFechaInicio(haceUnaSemana.toISOString().slice(0, 10));
    }
  };

  const getPeriodoTexto = () => {
    if (tipoFiltro === 'personalizado') {
      return `${fechaInicio} al ${fechaFin}`;
    }
    switch (filtroFecha) {
      case '7': return 'Últimos 7 días';
      case '15': return 'Últimos 15 días';
      case '30': return 'Últimos 30 días';
      case '90': return 'Últimos 3 meses';
      case '365': return 'Todo el año';
      default: return 'Últimos 7 días';
    }
  };

  if (loading || loadingStats) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <Spinner animation="border" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  if (rol !== 'admin' && rol !== 'anfitrion') {
    return <Alert variant="danger" className="mt-4 text-center">No tienes permisos para ver el dashboard.</Alert>;
  }

  if (error) {
    return <Alert variant="danger" className="mt-4">{error}</Alert>;
  }

  // Preparar datos para gráficos
  const chartVentasDiarias = {
    labels: stats.ventasDiarias.length > 0 ? stats.ventasDiarias.map(([fecha]) => fecha) : ['Sin datos'],
    datasets: [{
      label: 'Ventas Diarias',
      data: stats.ventasDiarias.length > 0 ? stats.ventasDiarias.map(([_, valor]) => valor) : [0],
      backgroundColor: 'rgba(99, 102, 241, 0.6)',
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 2,
      borderRadius: 8,
    }]
  };

  const chartEstadosVales = {
    labels: stats.totalVales > 0 ? ['Aprobados', 'Pendientes', 'Rechazados'] : ['Sin datos'],
    datasets: [{
      data: stats.totalVales > 0 ? [stats.valesAprobados, stats.valesPendientes, stats.valesRechazados] : [1],
      backgroundColor: stats.totalVales > 0 ? ['#22c55e', '#f59e0b', '#ef4444'] : ['#e5e7eb'],
      borderWidth: 2,
    }]
  };

  const chartTopProfesionales = {
    labels: stats.topProfesionales.length > 0 
      ? stats.topProfesionales.map(([nombre]) => nombre.length > 15 ? nombre.substring(0, 12) + '...' : nombre)
      : ['Sin datos'],
    datasets: [{
      label: 'Ingresos',
      data: stats.topProfesionales.length > 0 
        ? stats.topProfesionales.map(([_, stats]) => stats.ingresos)
        : [0],
      backgroundColor: stats.topProfesionales.length > 0 ? [
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)', 
        'rgba(245, 158, 11, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ] : ['rgba(229, 231, 235, 0.8)'],
      borderRadius: 8,
    }]
  };

  // Gráfico de torta para rendimiento de todos los usuarios
  const chartRendimientoUsuarios = {
    labels: Object.keys(stats.statsPorUsuario).length > 0 
      ? Object.entries(stats.statsPorUsuario)
          .sort((a, b) => b[1].ingresos - a[1].ingresos)
          .map(([nombre]) => nombre.length > 12 ? nombre.substring(0, 10) + '...' : nombre)
      : ['Sin datos'],
    datasets: [{
      label: 'Ingresos por Usuario',
      data: Object.keys(stats.statsPorUsuario).length > 0 
        ? Object.entries(stats.statsPorUsuario)
            .sort((a, b) => b[1].ingresos - a[1].ingresos)
            .map(([_, datos]) => datos.ingresos)
        : [1],
      backgroundColor: Object.keys(stats.statsPorUsuario).length > 0 ? [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
        '#14b8a6', '#eab308', '#f43f5e', '#a855f7', '#22c55e',
        '#0ea5e9', '#65a30d', '#dc2626', '#c026d3', '#2563eb'
      ].slice(0, Object.keys(stats.statsPorUsuario).length) : ['#e5e7eb'],
      hoverBackgroundColor: Object.keys(stats.statsPorUsuario).length > 0 ? [
        '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
        '#0891b2', '#65a30d', '#ea580c', '#db2777', '#4f46e5',
        '#0d9488', '#ca8a04', '#e11d48', '#9333ea', '#16a34a',
        '#0284c7', '#4d7c0f', '#b91c1c', '#a21caf', '#1d4ed8'
      ].slice(0, Object.keys(stats.statsPorUsuario).length) : ['#d1d5db'],
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverBorderWidth: 3
    }]
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh',
      paddingBottom: '140px'
    }}>
      {/* Header con filtros mejorados */}
      <Row className="mb-4 align-items-center" style={{ padding: '20px 15px 0' }}>
        <Col>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            borderRadius: 18,
            padding: '20px 24px',
            color: 'white',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.15)'
          }}>
            <h3 className="mb-2" style={{fontWeight: 700, fontSize: '1.75rem', margin: 0}}>
              <i className="bi bi-speedometer2 me-3"></i>Dashboard Ejecutivo
              <span style={{
                fontSize: 14, 
                fontWeight: 400, 
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 12px',
                borderRadius: 15,
                marginLeft: 15
              }}>
                <i className="bi bi-graph-up me-1"></i>
                En tiempo real
              </span>
            </h3>
            {stats && (
              <div style={{fontSize: 14, opacity: 0.9}}>
                <i className="bi bi-calendar-range me-2"></i>
                {getPeriodoTexto()} ({stats.rangoFechas.dias} días)
              </div>
            )}
          </div>
        </Col>
        <Col xs="auto">
          <div className="d-flex gap-2 align-items-center">
            {/* Selector de tipo de filtro */}
            <div className="btn-group" role="group">
              <input 
                type="radio" 
                className="btn-check" 
                name="tipoFiltro" 
                id="predefinido" 
                checked={tipoFiltro === 'predefinido'}
                onChange={() => handleTipoFiltroChange('predefinido')}
              />
              <label className="btn btn-outline-light btn-sm" htmlFor="predefinido" style={{
                borderRadius: '12px 0 0 12px',
                fontWeight: 600
              }}>
                <i className="bi bi-calendar-range me-1"></i>Predefinido
              </label>

              <input 
                type="radio" 
                className="btn-check" 
                name="tipoFiltro" 
                id="personalizado" 
                checked={tipoFiltro === 'personalizado'}
                onChange={() => handleTipoFiltroChange('personalizado')}
              />
              <label className="btn btn-outline-light btn-sm" htmlFor="personalizado" style={{
                borderRadius: '0 12px 12px 0',
                fontWeight: 600
              }}>
                <i className="bi bi-calendar-date me-1"></i>Personalizado
              </label>
            </div>

            {tipoFiltro === 'predefinido' ? (
              <Form.Select 
                value={filtroFecha} 
                onChange={(e) => setFiltroFecha(e.target.value)}
                style={{ 
                  borderRadius: 12, 
                  border: '2px solid #e5e7eb', 
                  minWidth: 150,
                  fontWeight: 600
                }}
              >
                <option value="7">Últimos 7 días</option>
                <option value="15">Últimos 15 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 3 meses</option>
                <option value="365">Todo el año</option>
              </Form.Select>
            ) : (
              <div className="d-flex gap-2">
                <div>
                  <Form.Control
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={{ 
                      borderRadius: 12, 
                      border: '2px solid #e5e7eb', 
                      fontSize: 14,
                      fontWeight: 600
                    }}
                    max={fechaFin || new Date().toISOString().slice(0, 10)}
                  />
                  <small className="text-muted">Desde</small>
                </div>
                <div>
                  <Form.Control
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    style={{ 
                      borderRadius: 12, 
                      border: '2px solid #e5e7eb', 
                      fontSize: 14,
                      fontWeight: 600
                    }}
                    min={fechaInicio}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                  <small className="text-muted">Hasta</small>
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>

      {/* Panel del día actual */}
      <Row className="mb-4" style={{ padding: '0 15px' }}>
        <Col>
          <Card className="border-0 shadow-sm" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
          }}>
            <Card.Body className="text-white">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title style={{fontWeight: 700, fontSize: 22, color: 'white', margin: 0}}>
                  <i className="bi bi-calendar-day me-2"></i>Estado del Día Actual
                  <span className="ms-2" style={{fontSize: 14, fontWeight: 400, opacity: 0.8}}>
                    <i className="bi bi-clock me-1"></i>
                    {tiempoActual.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Card.Title>
                <div style={{fontSize: 16, fontWeight: 600, opacity: 0.9}}>
                  {new Date().toLocaleDateString('es-ES', { 
                    weekday: 'long', 
                    day: 'numeric',
                    month: 'long'
                  })}
                </div>
              </div>
              
              <Row>
                <Col md={2}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12}}>
                    <div style={{fontSize: 24, fontWeight: 700}}>
                      ${stats.hoy.ingresos.toLocaleString()}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Ingresos Hoy</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12}}>
                    <div style={{fontSize: 24, fontWeight: 700}}>
                      ${stats.hoy.gananciaReal.toLocaleString()}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Ganancia Real</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12}}>
                    <div style={{fontSize: 24, fontWeight: 700}}>
                      ${stats.hoy.egresos.toLocaleString()}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Egresos Hoy</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12}}>
                    <div style={{fontSize: 24, fontWeight: 700, color: stats.hoy.margenDia >= 0 ? '#bbf7d0' : '#fecaca'}}>
                      ${stats.hoy.margenDia.toLocaleString()}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Margen Día</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12}}>
                    <div style={{fontSize: 24, fontWeight: 700}}>
                      {stats.hoy.totalValesDia}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Vales Hoy</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12}}>
                    <div style={{fontSize: 24, fontWeight: 700}}>
                      {stats.hoy.profesionalesActivos}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Profesionales</div>
                  </div>
                </Col>
              </Row>

              {/* Alertas de vales pendientes */}
              {(stats.hoy.valesServicio.pendientes > 0 || stats.hoy.valesGasto.pendientes > 0) && (
                <Row className="mt-3">
                  <Col>
                    <div style={{
                      background: 'rgba(255,193,7,0.2)', 
                      borderRadius: 12, 
                      padding: 12,
                      border: '1px solid rgba(255,193,7,0.3)'
                    }}>
                      <div className="d-flex align-items-center">
                        <i className="bi bi-exclamation-triangle me-2" style={{fontSize: 18, color: '#fbbf24'}}></i>
                        <span style={{fontWeight: 600}}>
                          Atención: Hay {stats.hoy.valesServicio.pendientes + stats.hoy.valesGasto.pendientes} vale(s) pendiente(s) de aprobación hoy
                        </span>
                      </div>
                    </div>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Métricas del período seleccionado */}
      <Row className="mb-4" style={{ padding: '0 15px' }}>
        <Col lg={12}>
          {/* Mensaje cuando no hay datos */}
          {stats.totalVales === 0 && (
            <Row className="mb-3">
              <Col>
                <Alert variant="info" style={{ borderRadius: 16, border: 'none' }}>
                  <div className="d-flex align-items-center">
                    <i className="bi bi-info-circle me-2" style={{ fontSize: '1.2rem' }}></i>
                    <div>
                      <strong>Sin datos para el período seleccionado</strong>
                      <br />
                      No se encontraron vales en el rango de fechas: {stats.rangoFechas.inicio} al {stats.rangoFechas.fin}
                      <br />
                      <small>Intenta seleccionar un período diferente o verifica que haya vales creados en esas fechas.</small>
                    </div>
                  </div>
                </Alert>
              </Col>
            </Row>
          )}
          
          <Row>
            <Col md={3} className="mb-3">
              <Card style={{
                border: 'none',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                height: '140px'
              }}>
                <Card.Body className="d-flex flex-column justify-content-center">
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <h6 style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Ingresos Totales</h6>
                      <h3 style={{ margin: 0, fontWeight: 700 }}>
                        ${stats.ingresosTotales.toLocaleString()}
                      </h3>
                      <small style={{ opacity: 0.8 }}>
                        Promedio: ${Math.round(stats.promedioVale).toLocaleString()}
                      </small>
                    </div>
                    <i className="bi bi-arrow-up-circle" style={{ fontSize: '2.5rem', opacity: 0.8 }}></i>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3} className="mb-3">
              <Card style={{
                border: 'none',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                height: '140px'
              }}>
                <Card.Body className="d-flex flex-column justify-content-center">
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <h6 style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Ganancia Real</h6>
                      <h3 style={{ margin: 0, fontWeight: 700 }}>
                        ${stats.gananciaReal.toLocaleString()}
                      </h3>
                      <small style={{ opacity: 0.8 }}>
                        Margen: {stats.ingresosTotales > 0 ? ((stats.gananciaReal/stats.ingresosTotales)*100).toFixed(1) : 0}%
                      </small>
                    </div>
                    <i className="bi bi-gem" style={{ fontSize: '2.5rem', opacity: 0.8 }}></i>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3} className="mb-3">
              <Card style={{
                border: 'none',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                height: '140px'
              }}>
                <Card.Body className="d-flex flex-column justify-content-center">
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <h6 style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Gastos</h6>
                      <h3 style={{ margin: 0, fontWeight: 700 }}>
                        ${stats.gastosTotales.toLocaleString()}
                      </h3>
                      <small style={{ opacity: 0.8 }}>
                        vs Ingresos: {stats.ingresosTotales > 0 ? ((stats.gastosTotales/stats.ingresosTotales)*100).toFixed(1) : 0}%
                      </small>
                    </div>
                    <i className="bi bi-arrow-down-circle" style={{ fontSize: '2.5rem', opacity: 0.8 }}></i>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3} className="mb-3">
              <Card style={{
                border: 'none',
                borderRadius: 16,
                background: `linear-gradient(135deg, ${stats.margen >= 0 ? '#8b5cf6' : '#f59e0b'} 0%, ${stats.margen >= 0 ? '#7c3aed' : '#d97706'} 100%)`,
                color: 'white',
                height: '140px'
              }}>
                <Card.Body className="d-flex flex-column justify-content-center">
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <h6 style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Margen Final</h6>
                      <h3 style={{ margin: 0, fontWeight: 700 }}>
                        ${stats.margen.toLocaleString()}
                      </h3>
                      <small style={{ opacity: 0.8 }}>
                        {stats.totalVales} vales procesados
                      </small>
                    </div>
                    <i className={`bi ${stats.margen >= 0 ? 'bi-graph-up' : 'bi-graph-down'}`} 
                       style={{ fontSize: '2.5rem', opacity: 0.8 }}></i>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* Gráfico de Rendimiento por Usuario */}
      <Row className="mb-4" style={{ padding: '0 15px' }}>
        <Col lg={12}>
          <Card style={{ border: 'none', borderRadius: 16, height: 'auto' }}>
            <Card.Header style={{ 
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
              borderRadius: '16px 16px 0 0',
              color: 'white',
              padding: '16px 24px'
            }}>
              <h5 style={{ margin: 0, fontWeight: 700 }}>
                <i className="bi bi-pie-chart-fill me-2"></i>
                Rendimiento de Todos los Usuarios
                <span style={{
                  fontSize: 12, 
                  fontWeight: 400, 
                  background: 'rgba(255,255,255,0.2)',
                  padding: '2px 8px',
                  borderRadius: 10,
                  marginLeft: 12
                }}>
                  {Object.keys(stats.statsPorUsuario).length} profesionales
                </span>
              </h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col lg={6}>
                  <div style={{ height: '400px', position: 'relative' }}>
                    {Object.keys(stats.statsPorUsuario).length > 0 ? (
                      <Doughnut 
                        data={chartRendimientoUsuarios} 
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          cutout: '40%',
                          plugins: {
                            legend: { 
                              position: 'right',
                              labels: { 
                                font: { family: 'Inter', size: 11, weight: '600' },
                                color: '#374151',
                                padding: 8,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 8
                              }
                            },
                            tooltip: {
                              backgroundColor: 'rgba(30, 41, 59, 0.95)',
                              titleColor: '#ffffff',
                              bodyColor: '#ffffff',
                              borderColor: 'rgba(255,255,255,0.2)',
                              borderWidth: 1,
                              cornerRadius: 12,
                              titleFont: { family: 'Inter', size: 14, weight: 'bold' },
                              bodyFont: { family: 'Inter', size: 13 },
                              callbacks: {
                                label: (context) => {
                                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                  const percentage = ((context.parsed / total) * 100).toFixed(1);
                                  const usuario = Object.entries(stats.statsPorUsuario)
                                    .sort((a, b) => b[1].ingresos - a[1].ingresos)[context.dataIndex];
                                  return [
                                    `${context.label}: $${context.parsed.toLocaleString()}`,
                                    `${percentage}% del total`,
                                    `${usuario[1].vales} vales procesados`
                                  ];
                                }
                              }
                            }
                          },
                          interaction: {
                            intersect: false,
                            mode: 'nearest'
                          }
                        }} 
                      />
                    ) : (
                      <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        color: '#64748b'
                      }}>
                        <i className="bi bi-pie-chart" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
                        <div style={{ marginTop: '16px', fontWeight: 600, fontSize: '1.1rem' }}>
                          Sin datos de rendimiento
                        </div>
                        <small>No hay datos para mostrar en el período seleccionado</small>
                      </div>
                    )}
                  </div>
                </Col>
                <Col lg={6}>
                  <div style={{ height: '400px', overflowY: 'auto', paddingLeft: '20px' }}>
                    <h6 style={{ fontWeight: 700, color: '#374151', marginBottom: '16px' }}>
                      <i className="bi bi-list-ol me-2"></i>
                      Desglose Detallado
                    </h6>
                    {Object.keys(stats.statsPorUsuario).length > 0 ? (
                      Object.entries(stats.statsPorUsuario)
                        .sort((a, b) => b[1].ingresos - a[1].ingresos)
                        .map(([nombre, datos], index) => {
                          const total = Object.values(stats.statsPorUsuario)
                            .reduce((sum, user) => sum + user.ingresos, 0);
                          const porcentaje = total > 0 ? ((datos.ingresos / total) * 100).toFixed(1) : 0;
                          
                          return (
                            <div key={nombre} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '12px 16px',
                              marginBottom: '10px',
                              background: index === 0 ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' :
                                         index === 1 ? 'linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%)' :
                                         index === 2 ? 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)' :
                                         '#f8fafc',
                              borderRadius: '12px',
                              border: index < 3 ? '2px solid rgba(99, 102, 241, 0.2)' : '1px solid #e2e8f0',
                              transition: 'all 0.2s ease'
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ 
                                  fontWeight: 700, 
                                  fontSize: '0.95rem', 
                                  color: '#374151',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  {index === 0 && <i className="bi bi-trophy-fill me-2" style={{ color: '#f59e0b' }}></i>}
                                  {index === 1 && <i className="bi bi-award-fill me-2" style={{ color: '#3b82f6' }}></i>}
                                  {index === 2 && <i className="bi bi-star-fill me-2" style={{ color: '#8b5cf6' }}></i>}
                                  <span style={{ 
                                    backgroundColor: index < 3 ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    marginRight: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                  }}>
                                    #{index + 1}
                                  </span>
                                  {nombre}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                  {datos.aprobados} aprobados • {datos.pendientes} pendientes • {datos.vales} total
                                </div>
                                <div style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#6366f1', 
                                  fontWeight: 600,
                                  marginTop: '2px'
                                }}>
                                  {porcentaje}% del total
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                                <div style={{ 
                                  fontWeight: 800, 
                                  color: '#059669',
                                  fontSize: '1.1rem'
                                }}>
                                  ${datos.ingresos.toLocaleString()}
                                </div>
                                <div style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#64748b',
                                  fontWeight: 500
                                }}>
                                  Promedio: ${datos.vales > 0 ? Math.round(datos.ingresos / datos.vales).toLocaleString() : 0}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: '#64748b'
                      }}>
                        <i className="bi bi-people" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                        <div style={{ marginTop: '16px', fontWeight: 600 }}>
                          No hay datos disponibles
                        </div>
                        <small>
                          Selecciona un período con actividad
                        </small>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Gráficos */}
      <Row style={{ padding: '0 15px' }}>
        <Col lg={8} className="mb-4">
          <Row>
            {/* Ventas Diarias */}
            <Col md={12} className="mb-4">
              <Card style={{ border: 'none', borderRadius: 16, height: '300px' }}>
                <Card.Header style={{ background: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
                  <h6 style={{ margin: 0, fontWeight: 600 }}>
                    <i className="bi bi-graph-up me-2"></i>
                    Tendencia de Ventas Diarias
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Bar 
                    data={chartVentasDiarias} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true }
                      }
                    }} 
                  />
                </Card.Body>
              </Card>
            </Col>

            {/* Top Profesionales */}
            <Col md={12} className="mb-4">
              <Card style={{ border: 'none', borderRadius: 16, height: '300px' }}>
                <Card.Header style={{ background: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
                  <h6 style={{ margin: 0, fontWeight: 600 }}>
                    <i className="bi bi-trophy me-2"></i>
                    Top 5 Profesionales del Período
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Bar 
                    data={chartTopProfesionales} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: 'y',
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { beginAtZero: true }
                      }
                    }} 
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Sidebar de Estadísticas */}
        <Col lg={4} className="mb-4">
          {/* Estado de Vales */}
          <Card style={{ border: 'none', borderRadius: 16, marginBottom: 20, height: '300px' }}>
            <Card.Header style={{ background: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
              <h6 style={{ margin: 0, fontWeight: 600 }}>
                <i className="bi bi-pie-chart me-2"></i>
                Estado de Vales
              </h6>
            </Card.Header>
            <Card.Body>
              <Doughnut 
                data={chartEstadosVales} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' }
                  }
                }} 
              />
            </Card.Body>
          </Card>

          {/* Lista de Profesionales */}
          <Card style={{ border: 'none', borderRadius: 16, height: 'auto' }}>
            <Card.Header style={{ background: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
              <h6 style={{ margin: 0, fontWeight: 600 }}>
                <i className="bi bi-people me-2"></i>
                Ranking Completo
              </h6>
            </Card.Header>
            <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {Object.keys(stats.statsPorUsuario).length > 0 ? (
                Object.entries(stats.statsPorUsuario)
                  .sort((a, b) => b[1].ingresos - a[1].ingresos)
                  .map(([nombre, datos], index) => (
                  <div key={nombre} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    marginBottom: '8px',
                    background: index < 3 ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : '#f8fafc',
                    borderRadius: '12px',
                    border: index < 3 ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                        {index < 3 && <i className="bi bi-trophy-fill me-1" style={{ color: '#f59e0b' }}></i>}
                        #{index + 1} {nombre}
                      </div>
                      <small style={{ color: '#64748b' }}>
                        {datos.aprobados} aprobados, {datos.pendientes} pendientes
                      </small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#059669' }}>
                        ${datos.ingresos.toLocaleString()}
                      </div>
                      <small style={{ color: '#64748b' }}>{datos.vales} vales</small>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#64748b'
                }}>
                  <i className="bi bi-people" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <div style={{ marginTop: '16px', fontWeight: 600 }}>
                    No hay datos de profesionales
                  </div>
                  <small>
                    No se encontraron vales en el período seleccionado
                  </small>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
