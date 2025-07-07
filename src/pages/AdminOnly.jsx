// AdminOnly.jsx
import { useAuth } from '../context/AuthContext';

function AdminOnly({ children }) {
  const { rol, loading } = useAuth();
  if (loading) return <div>Cargando....</div>;
  if (rol !== "admin") return <div>No autorizado</div>;
  return children;
}

export default AdminOnly;