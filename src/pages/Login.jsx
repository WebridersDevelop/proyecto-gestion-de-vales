import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo-peluqueria.png';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
    }
    setLoading(false);
  };

  return (
    <div className="login-bg" style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f7fafc 0%, #e0e7ef 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div className="login-container" style={{
        background: "#fff",
        borderRadius: 18,
        boxShadow: "0 4px 24px #0002",
        padding: "36px 28px 28px 28px",
        width: "100%",
        maxWidth: 350,
        fontFamily: "'Inter', 'Roboto', Arial, sans-serif"
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <img
            src={logo}
            alt="Logo Peluquería"
            style={{
              width: 70,
              height: 70,
              objectFit: 'contain',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 2px 8px #0001',
              marginBottom: 12
            }}
          />
          <h2 style={{ color: "#181818", fontWeight: 700, margin: "18px 0 8px 0", letterSpacing: "-1px" }}>Iniciar sesión</h2>
        </div>
        <form onSubmit={handleSubmit} autoComplete="on">
          <input
            className="form-control mb-3"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 15,
              padding: "10px 12px",
              background: "#f8fafc",
              color: "#222"
            }}
          />
          <input
            className="form-control mb-3"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 15,
              padding: "10px 12px",
              background: "#f8fafc",
              color: "#222"
            }}
          />
          {error && <div className="alert alert-danger py-2" style={{ borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{error}</div>}
          <button
            className="btn btn-primary w-100"
            type="submit"
            disabled={loading}
            style={{
              borderRadius: 8,
              fontWeight: 600,
              background: "#2563eb",
              border: "none",
              transition: "background 0.2s"
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;