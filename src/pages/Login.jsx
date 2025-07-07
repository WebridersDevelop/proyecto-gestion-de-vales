import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUserCircle } from "react-icons/fa";

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
    }
  };

  return (
    <div className="login-bg">
      <div className="login-container">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <FaUserCircle size={56} color="#181818" style={{ background: "#fff", borderRadius: "50%", padding: "6px", boxShadow: "0 2px 8px #0001" }}/>
          <h2 style={{ color: "#181818", fontWeight: 700, margin: "18px 0 8px 0" }}>Iniciar sesión</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            className="form-control mb-3"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="form-control mb-3"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button className="btn btn-primary w-100" type="submit">Entrar</button>
        </form>
      </div>
    </div>
  );
}

export default Login;