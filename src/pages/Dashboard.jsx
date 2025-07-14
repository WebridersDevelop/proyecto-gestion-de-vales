import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, Row, Col, Spinner, Alert, Badge, Form, Button } from 'react-bootstrap';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import { Chart, BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement, Filler } from 'chart.js';

Chart.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement, Filler);

function Dashboard() {
  const { rol, loading } = useAuth();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('7'); // 7 días por defecto
  const [usuarios, setUsuarios] = useState({});
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('predefinido'); // 'predefinido' o 'personalizado'
  const [tiempoActual, setTiempoActual] = useState(new Date());

  // Actualizar tiempo cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTiempoActual(new Date());
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Obtener usuarios para nombres
        const usuariosSnap = await getDocs(collection(db, 'usuarios'));
        const usuariosMap = {};
        usuariosSnap.forEach(doc => {
          const data = doc.data();
          usuariosMap[data.email] = data.nombre || data.email;
        });
        setUsuarios(usuariosMap);

        const valesServicioSnap = await getDocs(collection(db, 'vales_servicio'));
        const valesGastoSnap = await getDocs(collection(db, 'vales_gasto'));

        // Calcular fechas límite
        let fechaLimiteInicio, fechaLimiteFin;
        
        if (tipoFiltro === 'personalizado' && fechaInicio && fechaFin) {
          fechaLimiteInicio = new Date(fechaInicio);
          fechaLimiteFin = new Date(fechaFin);
          fechaLimiteFin.setHours(23, 59, 59, 999); // Incluir todo el día final
        } else {
          const ahora = new Date();
          fechaLimiteFin = new Date(ahora);
          fechaLimiteInicio = new Date();
          fechaLimiteInicio.setDate(ahora.getDate() - parseInt(filtroFecha));
        }

        let ingresos = 0;
        let egresos = 0;
        let valesServicioAprobados = 0;
        let valesServicioPendientes = 0;
        let valesServicioRechazados = 0;
        let valesGastoAprobados = 0;
        let valesGastoPendientes = 0;
        let valesGastoRechazados = 0;
        let gananciaReal = 0;

        // Estadísticas por usuario
        const statsPorUsuario = {};
        
        // Estadísticas por día - calcular rango dinámicamente
        const statsPorDia = {};
        const diasEnRango = Math.ceil((fechaLimiteFin - fechaLimiteInicio) / (1000 * 60 * 60 * 24));
        const maxDias = Math.min(diasEnRango, 30); // Máximo 30 días para el gráfico
        
        for (let i = maxDias - 1; i >= 0; i--) {
          const fecha = new Date(fechaLimiteFin);
          fecha.setDate(fecha.getDate() - i);
          const fechaStr = fecha.toISOString().slice(0, 10);
          statsPorDia[fechaStr] = { ingresos: 0, egresos: 0 };
        }

        // Procesar vales de servicio
        valesServicioSnap.forEach(doc => {
          const data = doc.data();
          const fechaVale = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
          const fechaStr = fechaVale.toISOString().slice(0, 10);
          
          // Solo contar vales dentro del rango de fecha seleccionado
          if (fechaVale >= fechaLimiteInicio && fechaVale <= fechaLimiteFin) {
            const valorVale = Number(data.valor) || 0;
            ingresos += valorVale;
            
            // Conteo por estado
            if (data.estado === 'aprobado') {
              valesServicioAprobados++;
              
              // Calcular ganancia real solo para vales aprobados
              let porcentajeProfesional = 100;
              if (data.dividirPorDos) {
                if (typeof data.dividirPorDos === 'string') {
                  porcentajeProfesional = Number(data.dividirPorDos);
                } else if (data.dividirPorDos === true) {
                  porcentajeProfesional = 50;
                }
              }
              const base = (valorVale * porcentajeProfesional) / 100;
              gananciaReal += base + (Number(data.comisionExtra) || 0);
            } else if (data.estado === 'rechazado') {
              valesServicioRechazados++;
            } else {
              valesServicioPendientes++;
            }

            // Stats por usuario (solo contar ingresos de vales aprobados para estadísticas reales)
            const usuario = data.peluqueroEmail || 'Desconocido';
            if (!statsPorUsuario[usuario]) {
              statsPorUsuario[usuario] = { ingresos: 0, vales: 0, aprobados: 0 };
            }
            statsPorUsuario[usuario].vales += 1;
            if (data.estado === 'aprobado') {
              statsPorUsuario[usuario].ingresos += valorVale;
              statsPorUsuario[usuario].aprobados += 1;
            }

            // Stats por día (solo ingresos aprobados)
            if (statsPorDia[fechaStr] && data.estado === 'aprobado') {
              statsPorDia[fechaStr].ingresos += valorVale;
            }
          }
        });

        // Procesar vales de gasto
        valesGastoSnap.forEach(doc => {
          const data = doc.data();
          const fechaVale = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
          const fechaStr = fechaVale.toISOString().slice(0, 10);
          
          if (fechaVale >= fechaLimiteInicio && fechaVale <= fechaLimiteFin) {
            const valorGasto = Number(data.valor) || 0;
            
            // Conteo por estado
            if (data.estado === 'aprobado') {
              egresos += valorGasto;
              valesGastoAprobados++;
              
              // Stats por día (solo egresos aprobados)
              if (statsPorDia[fechaStr]) {
                statsPorDia[fechaStr].egresos += valorGasto;
              }
            } else if (data.estado === 'rechazado') {
              valesGastoRechazados++;
            } else {
              valesGastoPendientes++;
            }
          }
        });

        // Convertir stats por usuario a array ordenado
        const topUsuarios = Object.entries(statsPorUsuario)
          .map(([email, data]) => ({
            email,
            nombre: usuariosMap[email] || email,
            ...data
          }))
          .sort((a, b) => b.ingresos - a.ingresos)
          .slice(0, 5);

        // Calcular totales correctos
        const totalValesAprobados = valesServicioAprobados + valesGastoAprobados;
        const totalValesPendientes = valesServicioPendientes + valesGastoPendientes;
        const totalValesRechazados = valesServicioRechazados + valesGastoRechazados;
        const totalVales = totalValesAprobados + totalValesPendientes + totalValesRechazados;

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

        // Procesar vales del día actual
        valesServicioSnap.forEach(doc => {
          const data = doc.data();
          const fechaVale = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
          const fechaStr = fechaVale.toISOString().slice(0, 10);
          
          if (fechaStr === hoy) {
            const valorVale = Number(data.valor) || 0;
            
            if (data.estado === 'aprobado') {
              estadisticasHoy.ingresos += valorVale;
              estadisticasHoy.valesServicio.aprobados++;
              
              // Calcular ganancia real del día
              let porcentajeProfesional = 100;
              if (data.dividirPorDos) {
                if (typeof data.dividirPorDos === 'string') {
                  porcentajeProfesional = Number(data.dividirPorDos);
                } else if (data.dividirPorDos === true) {
                  porcentajeProfesional = 50;
                }
              }
              const base = (valorVale * porcentajeProfesional) / 100;
              estadisticasHoy.gananciaReal += base + (Number(data.comisionExtra) || 0);
            } else if (data.estado === 'rechazado') {
              estadisticasHoy.valesServicio.rechazados++;
            } else {
              estadisticasHoy.valesServicio.pendientes++;
            }
            
            // Contar profesionales activos
            if (data.peluqueroEmail) {
              estadisticasHoy.profesionalesActivos.add(data.peluqueroEmail);
            }
          }
        });

        valesGastoSnap.forEach(doc => {
          const data = doc.data();
          const fechaVale = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
          const fechaStr = fechaVale.toISOString().slice(0, 10);
          
          if (fechaStr === hoy) {
            const valorGasto = Number(data.valor) || 0;
            
            if (data.estado === 'aprobado') {
              estadisticasHoy.egresos += valorGasto;
              estadisticasHoy.valesGasto.aprobados++;
            } else if (data.estado === 'rechazado') {
              estadisticasHoy.valesGasto.rechazados++;
            } else {
              estadisticasHoy.valesGasto.pendientes++;
            }
            
            // Contar profesionales activos
            if (data.peluqueroEmail) {
              estadisticasHoy.profesionalesActivos.add(data.peluqueroEmail);
            }
          }
        });

        // Convertir Set a número
        estadisticasHoy.profesionalesActivos = estadisticasHoy.profesionalesActivos.size;

        setStats({
          ingresos,
          egresos,
          saldo: ingresos - egresos,
          gananciaReal,
          margen: gananciaReal - egresos,
          valesAprobados: totalValesAprobados,
          valesPendientes: totalValesPendientes,
          valesRechazados: totalValesRechazados,
          totalVales,
          topUsuarios,
          statsPorDia,
          promedioVale: valesServicioAprobados > 0 ? ingresos / valesServicioAprobados : 0,
          tasaAprobacion: totalVales > 0 ? ((totalValesAprobados / totalVales) * 100) : 0,
          // Estadísticas adicionales
          valesServicio: {
            aprobados: valesServicioAprobados,
            pendientes: valesServicioPendientes,
            rechazados: valesServicioRechazados,
            total: valesServicioAprobados + valesServicioPendientes + valesServicioRechazados
          },
          valesGasto: {
            aprobados: valesGastoAprobados,
            pendientes: valesGastoPendientes,
            rechazados: valesGastoRechazados,
            total: valesGastoAprobados + valesGastoPendientes + valesGastoRechazados
          },
          rangoFechas: {
            inicio: fechaLimiteInicio.toISOString().slice(0, 10),
            fin: fechaLimiteFin.toISOString().slice(0, 10),
            dias: Math.ceil((fechaLimiteFin - fechaLimiteInicio) / (1000 * 60 * 60 * 24))
          },
          // Estadísticas del día actual
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
        setError('Error al cargar los indicadores');
        console.error(err);
      }
      setLoadingStats(false);
    };
    fetchStats();
  }, [filtroFecha, tipoFiltro, fechaInicio, fechaFin]);

  if (loading || loadingStats) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (!rol) return <div>No tienes permisos asignados. Contacta al administrador.</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;

  // Gráfico de barras mejorado
  const barData = {
    labels: ['Ingresos', 'Egresos', 'Ganancia Real', 'Margen'],
    datasets: [
      {
        label: 'Monto',
        data: [stats.ingresos, stats.egresos, stats.gananciaReal, stats.margen],
        backgroundColor: [
          'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          stats.margen >= 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)'
        ],
        borderRadius: 12,
        barThickness: 40,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)'
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
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
          label: (context) => `$${context.parsed.y.toLocaleString()}`
        }
      }
    },
    scales: {
      x: { 
        grid: { display: false }, 
        ticks: { 
          font: { family: 'Inter', size: 14, weight: '600' },
          color: '#1e293b'
        },
        border: { display: false }
      },
      y: { 
        grid: { 
          color: 'rgba(148, 163, 184, 0.3)',
          drawBorder: false
        }, 
        ticks: { 
          font: { family: 'Inter', size: 13, weight: '500' }, 
          color: '#64748b',
          callback: (value) => `$${value.toLocaleString()}`
        }, 
        beginAtZero: true,
        border: { display: false }
      }
    }
  };

  // Gráfico de estados
  const pieData = {
    labels: ['Aprobados', 'Pendientes', 'Rechazados'],
    datasets: [
      {
        data: [stats.valesAprobados, stats.valesPendientes, stats.valesRechazados],
        backgroundColor: [
          '#22c55e',
          '#f59e42', 
          '#ef4444'
        ],
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverBackgroundColor: [
          '#16a34a',
          '#d97706',
          '#dc2626'
        ],
        hoverBorderWidth: 4
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          font: { family: 'Inter', size: 13, weight: '600' },
          color: '#1e293b',
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
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
          label: (context) => `${context.label}: ${context.parsed} vales (${((context.parsed / stats.totalVales) * 100).toFixed(1)}%)`
        }
      }
    }
  };

  // Gráfico de línea temporal
  const lineData = {
    labels: Object.keys(stats.statsPorDia).map(fecha => {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Ingresos',
        data: Object.values(stats.statsPorDia).map(d => d.ingresos),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: '#22c55e',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      },
      {
        label: 'Egresos',
        data: Object.values(stats.statsPorDia).map(d => d.egresos),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top',
        labels: {
          font: { family: 'Inter', size: 13, weight: '600' },
          color: '#1e293b',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15
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
          label: (context) => `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`
        }
      }
    },
    scales: {
      x: {
        grid: { 
          color: 'rgba(148, 163, 184, 0.3)',
          drawBorder: false
        },
        ticks: {
          font: { family: 'Inter', size: 12, weight: '500' },
          color: '#64748b'
        },
        border: { display: false }
      },
      y: { 
        beginAtZero: true,
        grid: { 
          color: 'rgba(148, 163, 184, 0.3)',
          drawBorder: false
        },
        ticks: {
          font: { family: 'Inter', size: 12, weight: '500' },
          color: '#64748b',
          callback: (value) => `$${value.toLocaleString()}`
        },
        border: { display: false }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  // Gráfico donut para top usuarios
  const donutData = {
    labels: stats.topUsuarios.map(u => u.nombre),
    datasets: [
      {
        data: stats.topUsuarios.map(u => u.ingresos),
        backgroundColor: [
          '#3b82f6', 
          '#10b981', 
          '#f59e42', 
          '#ef4444', 
          '#8b5cf6'
        ],
        hoverBackgroundColor: [
          '#2563eb',
          '#059669',
          '#d97706',
          '#dc2626',
          '#7c3aed'
        ],
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverBorderWidth: 4
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          font: { family: 'Inter', size: 12, weight: '600' },
          color: '#1e293b',
          padding: 12,
          usePointStyle: true,
          pointStyle: 'circle'
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
          label: (context) => `${context.label}: $${context.parsed.toLocaleString()}`
        }
      }
    }
  };

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

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header con filtros mejorados */}
      <Row className="mb-4 align-items-center">
        <Col>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            borderRadius: 18,
            padding: '20px 24px',
            border: '2px solid rgba(255,255,255,0.1)',
            color: 'white'
          }}>
            <h3 className="mb-2" style={{fontWeight: 700, letterSpacing: '-1px', color: 'white', fontSize: 28}}>
              <i className="bi bi-speedometer2 me-3" style={{color: '#22c55e'}}></i>Dashboard Ejecutivo
              <span style={{
                fontSize: 14, 
                fontWeight: 400, 
                background: 'rgba(34, 197, 94, 0.2)',
                padding: '4px 12px',
                borderRadius: 15,
                marginLeft: 15,
                color: '#bbf7d0'
              }}>
                <i className="bi bi-graph-up me-1"></i>
                En tiempo real
              </span>
            </h3>
            {stats && (
              <div style={{fontSize: 14, opacity: 0.8}}>
                <i className="bi bi-calendar-range me-2"></i>
                Período: {stats.rangoFechas.inicio} al {stats.rangoFechas.fin} ({stats.rangoFechas.dias} días)
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
              <label className="btn btn-outline-primary btn-sm" htmlFor="predefinido" style={{
                borderRadius: '12px 0 0 12px',
                border: '2px solid #3b82f6',
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
              <label className="btn btn-outline-primary btn-sm" htmlFor="personalizado" style={{
                borderRadius: '0 12px 12px 0',
                border: '2px solid #3b82f6',
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
                  fontWeight: 600,
                  background: 'white'
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
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Card.Title style={{fontWeight: 700, fontSize: 22, color: 'white', margin: 0}}>
                  <i className="bi bi-calendar-day me-2"></i>Estado del Día Actual
                  <span className="ms-2" style={{fontSize: 14, fontWeight: 400, opacity: 0.8}}>
                    <i className="bi bi-clock me-1"></i>
                    Actualizado: {tiempoActual.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Card.Title>
                <div className="d-flex align-items-center gap-3">
                  <div style={{fontSize: 16, fontWeight: 600, opacity: 0.9}}>
                    {new Date().toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                  {stats.hoy.totalValesDia > 0 && (
                    <div style={{
                      background: 'rgba(255,255,255,0.2)', 
                      borderRadius: 20, 
                      padding: '4px 12px',
                      fontSize: 14,
                      fontWeight: 600
                    }}>
                      <i className="bi bi-activity me-1"></i>
                      Día Activo
                    </div>
                  )}
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
                    <div style={{fontSize: 14, opacity: 0.9}}>Vales Totales</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12}}>
                    <div style={{fontSize: 24, fontWeight: 700}}>
                      {stats.hoy.profesionalesActivos}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Profesionales Activos</div>
                  </div>
                </Col>
              </Row>
              
              <Row className="mt-3">
                <Col md={6}>
                  <div style={{background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15}}>
                    <h6 style={{color: 'white', fontWeight: 600, marginBottom: 10}}>
                      <i className="bi bi-receipt me-2"></i>Vales de Servicio Hoy
                    </h6>
                    <div className="d-flex justify-content-between">
                      <span>
                        <i className="bi bi-check-circle me-1"></i>
                        Aprobados: <strong>{stats.hoy.valesServicio.aprobados}</strong>
                      </span>
                      <span>
                        <i className="bi bi-clock me-1"></i>
                        Pendientes: <strong>{stats.hoy.valesServicio.pendientes}</strong>
                      </span>
                      <span>
                        <i className="bi bi-x-circle me-1"></i>
                        Rechazados: <strong>{stats.hoy.valesServicio.rechazados}</strong>
                      </span>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  <div style={{background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15}}>
                    <h6 style={{color: 'white', fontWeight: 600, marginBottom: 10}}>
                      <i className="bi bi-cash-stack me-2"></i>Vales de Gasto Hoy
                    </h6>
                    <div className="d-flex justify-content-between">
                      <span>
                        <i className="bi bi-check-circle me-1"></i>
                        Aprobados: <strong>{stats.hoy.valesGasto.aprobados}</strong>
                      </span>
                      <span>
                        <i className="bi bi-clock me-1"></i>
                        Pendientes: <strong>{stats.hoy.valesGasto.pendientes}</strong>
                      </span>
                      <span>
                        <i className="bi bi-x-circle me-1"></i>
                        Rechazados: <strong>{stats.hoy.valesGasto.rechazados}</strong>
                      </span>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Indicadores de rendimiento del día */}
              <Row className="mt-3">
                <Col md={3}>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9}}>Eficiencia del Día</div>
                    <div style={{fontSize: 18, fontWeight: 700}}>
                      {stats.hoy.gananciaReal > 0 ? 
                        ((stats.hoy.gananciaReal / (stats.hoy.gananciaReal + stats.hoy.egresos)) * 100).toFixed(1) : 0
                      }%
                    </div>
                  </div>
                </Col>
                <Col md={3}>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9}}>Promedio por Vale</div>
                    <div style={{fontSize: 18, fontWeight: 700}}>
                      ${stats.hoy.valesServicio.aprobados > 0 ? 
                        Math.round(stats.hoy.ingresos / stats.hoy.valesServicio.aprobados).toLocaleString() : 0
                      }
                    </div>
                  </div>
                </Col>
                <Col md={3}>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9}}>Tasa Aprobación</div>
                    <div style={{fontSize: 18, fontWeight: 700}}>
                      {stats.hoy.totalValesDia > 0 ? 
                        (((stats.hoy.valesServicio.aprobados + stats.hoy.valesGasto.aprobados) / stats.hoy.totalValesDia) * 100).toFixed(1) : 0
                      }%
                    </div>
                  </div>
                </Col>
                <Col md={3}>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9}}>Estado General</div>
                    <div style={{fontSize: 18, fontWeight: 700}}>
                      {stats.hoy.margenDia > 0 ? '🟢 Positivo' : 
                       stats.hoy.margenDia === 0 ? '🟡 Neutro' : '🔴 Negativo'}
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Alertas y notificaciones del día */}
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
                          Atención: Hay {stats.hoy.valesServicio.pendientes + stats.hoy.valesGasto.pendientes} vale(s) pendiente(s) de aprobación
                        </span>
                      </div>
                    </div>
                  </Col>
                </Row>
              )}

              {/* Objetivos del día */}
              <Row className="mt-3">
                <Col>
                  <div style={{background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15}}>
                    <h6 style={{color: 'white', fontWeight: 600, marginBottom: 15}}>
                      <i className="bi bi-target me-2"></i>Progreso del Día
                    </h6>
                    <Row>
                      <Col md={4}>
                        <div style={{marginBottom: 10}}>
                          <div style={{fontSize: 13, opacity: 0.9, marginBottom: 5}}>Meta de Ingresos (vs promedio)</div>
                          <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 8, height: 8, overflow: 'hidden'}}>
                            <div style={{
                              background: stats.hoy.ingresos > stats.promedioVale * 5 ? '#22c55e' : '#f59e42',
                              height: '100%',
                              width: `${Math.min((stats.hoy.ingresos / (stats.promedioVale * 5)) * 100, 100)}%`,
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                          <div style={{fontSize: 12, opacity: 0.8, marginTop: 2}}>
                            ${stats.hoy.ingresos.toLocaleString()} / ${Math.round(stats.promedioVale * 5).toLocaleString()}
                          </div>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div style={{marginBottom: 10}}>
                          <div style={{fontSize: 13, opacity: 0.9, marginBottom: 5}}>Vales Procesados (Meta: 10)</div>
                          <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 8, height: 8, overflow: 'hidden'}}>
                            <div style={{
                              background: stats.hoy.totalValesDia >= 10 ? '#22c55e' : '#f59e42',
                              height: '100%',
                              width: `${Math.min((stats.hoy.totalValesDia / 10) * 100, 100)}%`,
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                          <div style={{fontSize: 12, opacity: 0.8, marginTop: 2}}>
                            {stats.hoy.totalValesDia} / 10 vales
                          </div>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div style={{marginBottom: 10}}>
                          <div style={{fontSize: 13, opacity: 0.9, marginBottom: 5}}>Margen Positivo</div>
                          <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 8, height: 8, overflow: 'hidden'}}>
                            <div style={{
                              background: stats.hoy.margenDia > 0 ? '#22c55e' : '#ef4444',
                              height: '100%',
                              width: stats.hoy.margenDia > 0 ? '100%' : '0%',
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                          <div style={{fontSize: 12, opacity: 0.8, marginTop: 2}}>
                            {stats.hoy.margenDia > 0 ? '✓ Logrado' : '✗ Pendiente'}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* KPIs principales */}
      <Row className="mb-4">
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white text-center">
              <Card.Title style={{fontWeight: 700, fontSize: 16, color: 'white', marginBottom: 15}}>
                <i className="bi bi-cash-coin me-2"></i>Ingresos Totales
              </Card.Title>
              <Card.Text style={{fontSize: 28, fontWeight: 700, marginBottom: 8}}>
                ${stats.ingresos.toLocaleString()}
              </Card.Text>
              <div style={{background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 13}}>
                Promedio por vale: ${Math.round(stats.promedioVale).toLocaleString()}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white text-center">
              <Card.Title style={{fontWeight: 700, fontSize: 16, color: 'white', marginBottom: 15}}>
                <i className="bi bi-wallet-fill me-2"></i>Ganancia Real
              </Card.Title>
              <Card.Text style={{fontSize: 28, fontWeight: 700, marginBottom: 8}}>
                ${stats.gananciaReal.toLocaleString()}
              </Card.Text>
              <div style={{background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 13}}>
                {((stats.gananciaReal / stats.ingresos) * 100 || 0).toFixed(1)}% del ingreso
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white text-center">
              <Card.Title style={{fontWeight: 700, fontSize: 16, color: 'white', marginBottom: 15}}>
                <i className="bi bi-cash-stack me-2"></i>Egresos
              </Card.Title>
              <Card.Text style={{fontSize: 28, fontWeight: 700, marginBottom: 8}}>
                ${stats.egresos.toLocaleString()}
              </Card.Text>
              <div style={{background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 13}}>
                Gastos operativos
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100" style={{
            borderRadius: 18, 
            background: stats.margen >= 0 ? 
              'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
              'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white text-center">
              <Card.Title style={{fontWeight: 700, fontSize: 16, color: 'white', marginBottom: 15}}>
                <i className="bi bi-graph-up-arrow me-2"></i>Margen Neto
              </Card.Title>
              <Card.Text style={{fontSize: 28, fontWeight: 700, marginBottom: 8}}>
                ${stats.margen.toLocaleString()}
              </Card.Text>
              <div style={{background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 13}}>
                {((stats.margen / stats.gananciaReal) * 100 || 0).toFixed(1)}% de ganancia
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* KPIs secundarios */}
      <Row className="mb-4">
        <Col md={4} className="mb-3">
          <Card className="border-0 shadow-sm" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white text-center">
              <Card.Title style={{fontWeight: 700, fontSize: 16, color: 'white', marginBottom: 15}}>
                <i className="bi bi-clipboard-data me-2"></i>Total de Vales
              </Card.Title>
              <Card.Text style={{fontSize: 32, fontWeight: 700, marginBottom: 10}}>
                {stats.totalVales}
              </Card.Text>
              <div style={{background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 13}}>
                Servicios: {stats.valesServicio.total} | Gastos: {stats.valesGasto.total}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-3">
          <Card className="border-0 shadow-sm" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white text-center">
              <Card.Title style={{fontWeight: 700, fontSize: 16, color: 'white', marginBottom: 15}}>
                <i className="bi bi-check-circle me-2"></i>Tasa de Aprobación
              </Card.Title>
              <Card.Text style={{fontSize: 32, fontWeight: 700, marginBottom: 10}}>
                {stats.tasaAprobacion.toFixed(1)}%
              </Card.Text>
              <div style={{background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 13}}>
                {stats.valesAprobados} de {stats.totalVales} aprobados
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-3">
          <Card className="border-0 shadow-sm" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #f59e42 0%, #d97706 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white text-center">
              <Card.Title style={{fontWeight: 700, fontSize: 16, color: 'white', marginBottom: 15}}>
                <i className="bi bi-clock me-2"></i>Vales Pendientes
              </Card.Title>
              <Card.Text style={{fontSize: 32, fontWeight: 700, marginBottom: 10}}>
                {stats.valesPendientes}
              </Card.Text>
              <div style={{background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 13}}>
                Requieren atención inmediata
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Gráficos principales */}
      <Row className="mb-4">
        <Col lg={8} className="mb-3">
          <Card className="border-0 shadow-lg" style={{
            borderRadius: 18,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '2px solid rgba(99, 102, 241, 0.15)',
            overflow: 'hidden'
          }}>
            <Card.Body style={{padding: '24px'}}>
              <Card.Title style={{
                fontWeight: 700, 
                fontSize: 20, 
                marginBottom: 24, 
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <i className="bi bi-bar-chart-fill me-3" style={{
                    color: '#6366f1',
                    fontSize: 22,
                    background: 'rgba(99, 102, 241, 0.1)',
                    padding: '8px',
                    borderRadius: '10px'
                  }}></i>
                  Análisis Financiero
                </div>
                <span style={{
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#64748b',
                  background: 'rgba(99, 102, 241, 0.1)',
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: '1px solid rgba(99, 102, 241, 0.2)'
                }}>
                  <i className="bi bi-activity me-1"></i>
                  Período activo
                </span>
              </Card.Title>
              <div style={{height: 320, position: 'relative'}}>
                <Bar data={barData} options={barOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4} className="mb-3">
          <Card className="border-0 shadow-lg" style={{
            borderRadius: 18,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '2px solid rgba(34, 197, 94, 0.15)',
            overflow: 'hidden'
          }}>
            <Card.Body style={{padding: '24px'}}>
              <Card.Title style={{
                fontWeight: 700, 
                fontSize: 20, 
                marginBottom: 24, 
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center'
              }}>
                <i className="bi bi-pie-chart-fill me-3" style={{
                  color: '#22c55e',
                  fontSize: 22,
                  background: 'rgba(34, 197, 94, 0.1)',
                  padding: '8px',
                  borderRadius: '10px'
                }}></i>
                Estados de Vales
              </Card.Title>
              <div style={{height: 250, position: 'relative'}}>
                <Pie data={pieData} options={pieOptions} />
              </div>
              <div className="mt-4 d-flex justify-content-center gap-2 flex-wrap">
                <div style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: 25,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '2px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}>
                  ✓ {stats.valesAprobados}
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, #f59e42 0%, #d97706 100%)',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: 25,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '2px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 4px 12px rgba(245, 158, 66, 0.3)'
                }}>
                  ⏳ {stats.valesPendientes}
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: 25,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '2px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}>
                  ✗ {stats.valesRechazados}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tendencias y Top Usuarios */}
      <Row className="mb-4">
        <Col lg={8} className="mb-3">
          <Card className="border-0 shadow-lg" style={{
            borderRadius: 18,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '2px solid rgba(239, 68, 68, 0.15)',
            overflow: 'hidden'
          }}>
            <Card.Body style={{padding: '24px'}}>
              <Card.Title style={{
                fontWeight: 700, 
                fontSize: 20, 
                marginBottom: 24, 
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <i className="bi bi-graph-up me-3" style={{
                    color: '#ef4444',
                    fontSize: 22,
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '8px',
                    borderRadius: '10px'
                  }}></i>
                  Tendencia Temporal
                </div>
                <span style={{
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#64748b',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                  <i className="bi bi-calendar-range me-1"></i>
                  {Object.keys(stats.statsPorDia).length} días
                </span>
              </Card.Title>
              <div style={{height: 320, position: 'relative'}}>
                <Line data={lineData} options={lineOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4} className="mb-3">
          <Card className="border-0 shadow-lg" style={{
            borderRadius: 18,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '2px solid rgba(59, 130, 246, 0.15)',
            overflow: 'hidden'
          }}>
            <Card.Body style={{padding: '24px'}}>
              <Card.Title style={{
                fontWeight: 700, 
                fontSize: 20, 
                marginBottom: 24, 
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center'
              }}>
                <i className="bi bi-people-fill me-3" style={{
                  color: '#3b82f6',
                  fontSize: 22,
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '8px',
                  borderRadius: '10px'
                }}></i>
                Top 5 Profesionales
              </Card.Title>
              <div style={{height: 220, marginBottom: 20, position: 'relative'}}>
                <Doughnut data={donutData} options={donutOptions} />
              </div>
              <div style={{maxHeight: 200, overflowY: 'auto'}}>
                {stats.topUsuarios.length > 0 ? (
                  stats.topUsuarios.map((usuario, idx) => (
                    <div key={usuario.email} className="d-flex justify-content-between align-items-center mb-3 p-3" 
                         style={{
                           background: idx === 0 ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' :
                                      idx === 1 ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' :
                                      idx === 2 ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' :
                                      'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
                           borderRadius: 12, 
                           fontSize: 14,
                           color: idx < 3 ? 'white' : '#1e293b',
                           border: '2px solid rgba(255,255,255,0.2)',
                           boxShadow: idx < 3 ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)'
                         }}>
                      <div>
                        <strong style={{fontSize: 15}}>#{idx + 1} {usuario.nombre}</strong>
                        <div style={{fontSize: 12, opacity: 0.9, marginTop: 2}}>
                          {usuario.vales} vales • {usuario.aprobados} aprobados
                          {usuario.vales > 0 && (
                            <span className="ms-1">
                              ({((usuario.aprobados / usuario.vales) * 100).toFixed(1)}% aprobación)
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.25)',
                        padding: '6px 10px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        border: '1px solid rgba(255,255,255,0.3)'
                      }}>
                        ${usuario.ingresos.toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted py-4">
                    <i className="bi bi-info-circle mb-2" style={{fontSize: '1.5rem'}}></i>
                    <p className="mb-0">No hay datos de usuarios en este período</p>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Estadísticas detalladas */}
      <Row className="mb-4">
        <Col md={6} className="mb-3">
          <Card className="border-0 shadow-sm" style={{
            borderRadius: 18,
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white">
              <Card.Title style={{fontWeight: 700, fontSize: 18, marginBottom: 20, color: 'white'}}>
                <i className="bi bi-receipt me-2"></i>Análisis de Vales de Servicio
              </Card.Title>
              <Row>
                <Col xs={6}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.2)', borderRadius: 12, marginBottom: 15}}>
                    <div style={{fontSize: 28, fontWeight: 700}}>
                      {stats.valesServicio.aprobados}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Aprobados</div>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12, marginBottom: 15}}>
                    <div style={{fontSize: 28, fontWeight: 700}}>
                      {stats.valesServicio.pendientes}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Pendientes</div>
                  </div>
                </Col>
              </Row>
              <div className="text-center" style={{background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15}}>
                <div style={{fontSize: 14, marginBottom: 8}}>
                  Total de vales de servicio: <strong>{stats.valesServicio.total}</strong>
                </div>
                <div style={{fontSize: 14}}>
                  Tasa de aprobación: <strong>
                    {stats.valesServicio.total > 0 ? 
                      ((stats.valesServicio.aprobados / stats.valesServicio.total) * 100).toFixed(1) : 0
                    }%
                  </strong>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} className="mb-3">
          <Card className="border-0 shadow-sm" style={{
            borderRadius: 18,
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white">
              <Card.Title style={{fontWeight: 700, fontSize: 18, marginBottom: 20, color: 'white'}}>
                <i className="bi bi-cash-stack me-2"></i>Análisis de Vales de Gasto
              </Card.Title>
              <Row>
                <Col xs={6}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.2)', borderRadius: 12, marginBottom: 15}}>
                    <div style={{fontSize: 28, fontWeight: 700}}>
                      {stats.valesGasto.aprobados}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Aprobados</div>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="text-center p-3" style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12, marginBottom: 15}}>
                    <div style={{fontSize: 28, fontWeight: 700}}>
                      {stats.valesGasto.pendientes}
                    </div>
                    <div style={{fontSize: 14, opacity: 0.9}}>Pendientes</div>
                  </div>
                </Col>
              </Row>
              <div className="text-center" style={{background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15}}>
                <div style={{fontSize: 14, marginBottom: 8}}>
                  Total de vales de gasto: <strong>{stats.valesGasto.total}</strong>
                </div>
                <div style={{fontSize: 14}}>
                  Promedio por gasto: <strong>
                    ${stats.valesGasto.aprobados > 0 ? 
                      Math.round(stats.egresos / stats.valesGasto.aprobados).toLocaleString() : 0
                    }
                  </strong>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Resumen ejecutivo */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm" style={{
            borderRadius: 18, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            <Card.Body className="text-white">
              <Card.Title style={{fontWeight: 700, fontSize: 20, color: 'white', marginBottom: 20}}>
                <i className="bi bi-trophy me-2"></i>Resumen Ejecutivo
                <span style={{
                  fontSize: 12, 
                  fontWeight: 400, 
                  background: 'rgba(255,255,255,0.2)',
                  padding: '4px 12px',
                  borderRadius: 15,
                  marginLeft: 15
                }}>
                  Vista consolidada
                </span>
              </Card.Title>
              <Row>
                <Col md={2}>
                  <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 15, textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9, marginBottom: 8}}>Eficiencia Operativa</div>
                    <div style={{fontSize: 22, fontWeight: 700}}>
                      {stats.gananciaReal > 0 ? 
                        ((stats.gananciaReal / (stats.gananciaReal + stats.egresos)) * 100).toFixed(1) : 0
                      }%
                    </div>
                  </div>
                </Col>
                <Col md={2}>
                  <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 15, textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9, marginBottom: 8}}>ROI Promedio</div>
                    <div style={{fontSize: 22, fontWeight: 700}}>
                      {stats.egresos > 0 ? 
                        ((stats.margen / stats.egresos) * 100).toFixed(1) : '∞'
                      }%
                    </div>
                  </div>
                </Col>
                <Col md={2}>
                  <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 15, textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9, marginBottom: 8}}>Vales/Día Promedio</div>
                    <div style={{fontSize: 22, fontWeight: 700}}>
                      {stats.rangoFechas.dias > 0 ? 
                        Math.round(stats.totalVales / stats.rangoFechas.dias) : 0
                      }
                    </div>
                  </div>
                </Col>
                <Col md={3}>
                  <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 15, textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9, marginBottom: 8}}>Desglose de Vales</div>
                    <div style={{fontSize: 16, fontWeight: 600}}>
                      Servicio: {stats.valesServicio.total} | Gasto: {stats.valesGasto.total}
                    </div>
                  </div>
                </Col>
                <Col md={3}>
                  <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 15, textAlign: 'center'}}>
                    <div style={{fontSize: 14, opacity: 0.9, marginBottom: 8}}>Status General</div>
                    <div style={{fontSize: 20, fontWeight: 700}}>
                      {stats.margen > 0 ? '🟢 Rentable' : stats.margen === 0 ? '🟡 Equilibrio' : '🔴 Pérdidas'}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;