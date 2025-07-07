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

  // Datos para el gráfico de barras
  const barData = {
    labels: ['Ingresos', 'Egresos', 'Saldo Neto'],
    datasets: [
      {
        label: 'Monto',
        data: [stats.ingresos, stats.egresos, stats.saldo],
        backgroundColor: ['#198754', '#dc3545', stats.saldo >= 0 ? '#198754' : '#dc3545'],
      },
    ],
  };

  // Datos para el gráfico de torta
  const pieData = {
    labels: ['Aprobados', 'Pendientes', 'Rechazados'],
    datasets: [
      {
        data: [stats.valesAprobados, stats.valesPendientes, stats.valesRechazados],
        backgroundColor: ['#198754', '#ffc107', '#dc3545'],
      },
    ],
  };

  return (
    <div>
      <h3 className="mb-4">Dashboard</h3>
      <Row className="mb-4">
        <Col md={8} className="mb-3">
          <Card className="text-center border-dark">
            <Card.Body>
              <Card.Title>Resumen Económico</Card.Title>
              <div style={{maxWidth: 500, margin: '0 auto'}}>
                <Bar data={barData} options={{
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-3">
          <Card className="text-center border-dark">
            <Card.Body>
              <Card.Title>Estados de Vales</Card.Title>
              <div style={{maxWidth: 250, margin: '0 auto'}}>
                <Pie data={pieData} options={{
                  plugins: { legend: { position: 'bottom' } }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row>
        <Col md={3} className="mb-3">
          <Card className="text-center border-dark">
            <Card.Body>
              <Card.Title>Ingresos</Card.Title>
              <Card.Text style={{fontSize: 20, color: 'green'}}>${stats.ingresos.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-dark">
            <Card.Body>
              <Card.Title>Egresos</Card.Title>
              <Card.Text style={{fontSize: 20, color: 'red'}}>${stats.egresos.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-dark">
            <Card.Body>
              <Card.Title>Saldo Neto</Card.Title>
              <Card.Text style={{fontSize: 20, color: stats.saldo >= 0 ? 'green' : 'red'}}>${stats.saldo.toLocaleString()}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="text-center border-dark">
            <Card.Body>
              <Card.Title>Total de Vales</Card.Title>
              <Card.Text style={{fontSize: 20}}>{stats.totalVales}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;