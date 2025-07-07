import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
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
        backgroundColor: ['#6EE7B7', '#FDE68A', '#FCA5A5'],
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
    <div>
      <h3 className="mb-4" style={{fontWeight: 600, letterSpacing: '-1px'}}>Dashboard</h3>
      <Row className="mb-4">
        <Col md={8} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 500, fontSize: 20}}>Resumen Económico</Card.Title>
              <div style={{maxWidth: 500, margin: '0 auto'}}>
                <Bar data={barData} options={barOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 500, fontSize: 20}}>Estados de Vales</Card.Title>
              <div style={{maxWidth: 250, margin: '0 auto'}}>
                <Pie data={pieData} options={pieOptions} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row>
        <Col md={3} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 500, fontSize: 16, color: '#6EE7B7'}}>Ingresos</Card.Title>
              <Card.Text style={{fontSize: 22, color: '#059669', fontWeight: 600}}>${stats.ingresos.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 500, fontSize: 16, color: '#FCA5A5'}}>Egresos</Card.Title>
              <Card.Text style={{fontSize: 22, color: '#dc2626', fontWeight: 600}}>${stats.egresos.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 500, fontSize: 16, color: stats.saldo >= 0 ? '#6EE7B7' : '#FCA5A5'}}>Saldo Neto</Card.Title>
              <Card.Text style={{fontSize: 22, color: stats.saldo >= 0 ? '#059669' : '#dc2626', fontWeight: 600}}>${stats.saldo.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-0 shadow-sm" style={{borderRadius: 18}}>
            <Card.Body>
              <Card.Title style={{fontWeight: 500, fontSize: 16, color: '#6366f1'}}>Total de Vales</Card.Title>
              <Card.Text style={{fontSize: 22, color: '#6366f1', fontWeight: 600}}>{stats.totalVales}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;