import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart, BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

Chart.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

function Dashboard() {
  const { rol, loading } = useAuth();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const valesServicioSnap = await getDocs(collection(db, 'vales_servicio'));
        const valesGastoSnap = await getDocs(collection(db, 'vales_gasto'));

        let ingresos = 0;
        let egresos = 0;
        let valesAprobados = 0;
        let valesPendientes = 0;
        let valesRechazados = 0;

        valesServicioSnap.forEach(doc => {
          const data = doc.data();
          ingresos += Number(data.valor) || 0;
          if (data.estado === 'aprobado') valesAprobados++;
          else if (data.estado === 'rechazado') valesRechazados++;
          else valesPendientes++;
        });
        valesGastoSnap.forEach(doc => {
          const data = doc.data();
          egresos += Number(data.valor) || 0;
          if (data.estado === 'aprobado') valesAprobados++;
          else if (data.estado === 'rechazado') valesRechazados++;
          else valesPendientes++;
        });

        setStats({
          ingresos,
          egresos,
          saldo: ingresos - egresos,
          valesAprobados,
          valesPendientes,
          valesRechazados,
          totalVales: valesServicioSnap.size + valesGastoSnap.size
        });
      } catch (err) {
        setError('Error al cargar los indicadores');
      }
      setLoadingStats(false);
    };
    fetchStats();
  }, []);

  if (loading || loadingStats) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (!rol) return <div>No tienes permisos asignados. Contacta al administrador.</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;

  // Gráficos minimalistas
  const barData = {
    labels: ['Ingresos', 'Egresos', 'Saldo Neto'],
    datasets: [
      {
        label: 'Monto',
        data: [stats.ingresos, stats.egresos, stats.saldo],
        backgroundColor: ['#6EE7B7', '#FCA5A5', stats.saldo >= 0 ? '#6EE7B7' : '#FCA5A5'],
        borderRadius: 8,
        barThickness: 36,
      },
    ],
  };

  const barOptions = {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 14 } } },
      y: { grid: { color: '#f0f0f0' }, ticks: { font: { family: 'Inter', size: 13 } }, beginAtZero: true }
    }
  };

  const pieData = {
    labels: ['Aprobados', 'Pendientes', 'Rechazados'],
    datasets: [
      {
        data: [stats.valesAprobados, stats.valesPendientes, stats.valesRechazados],
        backgroundColor: ['#22c55e', '#f59e42', '#ef4444'],
        borderWidth: 1,
        borderColor: '#fff'
      },
    ],
  };

  const pieOptions = {
    plugins: {
      legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 13 } } }
    }
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <h3 className="mb-4" style={{fontWeight: 700, letterSpacing: '-1px'}}>
        <i className="bi bi-bar-chart-fill me-2"></i>Dashboard
      </h3>
      <Row className="mb-4">
        <Col md={8} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 600, fontSize: 20}}>
                <i className="bi bi-graph-up-arrow me-2"></i>Resumen Económico
              </Card.Title>
              <div style={{maxWidth: 500, margin: '0 auto'}}>
                <Bar data={barData} options={barOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 600, fontSize: 20}}>
                <i className="bi bi-pie-chart-fill me-2"></i>Estados de Vales
              </Card.Title>
              <div style={{maxWidth: 250, margin: '0 auto'}}>
                <Pie data={pieData} options={pieOptions} />
              </div>
              <div className="mt-3 d-flex justify-content-center gap-2">
                <Badge bg="success" style={{fontSize: 13}}>Aprobados: {stats.valesAprobados}</Badge>
                <Badge bg="warning" text="dark" style={{fontSize: 13}}>Pendientes: {stats.valesPendientes}</Badge>
                <Badge bg="danger" style={{fontSize: 13}}>Rechazados: {stats.valesRechazados}</Badge>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row>
        <Col md={3} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 600, fontSize: 16, color: '#22c55e'}}>
                <i className="bi bi-cash-coin me-1"></i>Ingresos
              </Card.Title>
              <Card.Text style={{fontSize: 22, color: '#059669', fontWeight: 700}}>${stats.ingresos.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 600, fontSize: 16, color: '#ef4444'}}>
                <i className="bi bi-cash-stack me-1"></i>Egresos
              </Card.Title>
              <Card.Text style={{fontSize: 22, color: '#dc2626', fontWeight: 700}}>${stats.egresos.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 600, fontSize: 16, color: stats.saldo >= 0 ? '#22c55e' : '#ef4444'}}>
                <i className="bi bi-wallet2 me-1"></i>Saldo Neto
              </Card.Title>
              <Card.Text style={{fontSize: 22, color: stats.saldo >= 0 ? '#059669' : '#dc2626', fontWeight: 700}}>${stats.saldo.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 600, fontSize: 16, color: '#6366f1'}}>
                <i className="bi bi-clipboard-data me-1"></i>Total de Vales
              </Card.Title>
              <Card.Text style={{fontSize: 22, color: '#6366f1', fontWeight: 700}}>{stats.totalVales}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;