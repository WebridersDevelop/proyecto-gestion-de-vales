import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo-peluqueria.png';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      height: "100vh",
      width: "100vw",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "fixed",
      top: 0,
      left: 0,
      overflow: "hidden",
      margin: 0,
      padding: 0
    }}>
      {/* Animated background elements */}
      <div style={{
        position: "absolute",
        top: "10%",
        left: "10%",
        width: "300px",
        height: "300px",
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "50%",
        filter: "blur(40px)",
        animation: "float 6s ease-in-out infinite"
      }}></div>
      <div style={{
        position: "absolute",
        bottom: "20%",
        right: "15%",
        width: "200px",
        height: "200px",
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "50%",
        filter: "blur(30px)",
        animation: "float 4s ease-in-out infinite reverse"
      }}></div>
      
      <div className="login-container" style={{
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        borderRadius: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)",
        padding: "28px 24px 24px 24px",
        width: "100%",
        maxWidth: 360,
        fontFamily: "'Inter', 'Roboto', Arial, sans-serif",
        position: "relative",
        zIndex: 1
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "50%",
            padding: "6px",
            marginBottom: 12,
            boxShadow: "0 4px 16px rgba(102, 126, 234, 0.3)"
          }}>
            <img
              src={logo}
              alt="Logo Peluquería"
              style={{
                width: 56,
                height: 56,
                objectFit: 'contain',
                borderRadius: '50%',
                background: '#fff',
                padding: "3px"
              }}
            />
          </div>
          <h2 style={{ 
            color: "#1a1a1a", 
            fontWeight: 700, 
            margin: "0 0 4px 0", 
            letterSpacing: "-0.5px",
            fontSize: "24px"
          }}>
            Bienvenido
          </h2>
          <p style={{
            color: "#6b7280",
            fontSize: "13px",
            margin: 0,
            textAlign: "center"
          }}>
            Ingresa tus credenciales para continuar
          </p>
        </div>
        <form onSubmit={handleSubmit} autoComplete="on">
          <div style={{ position: "relative", marginBottom: 16 }}>
            <input
              className="form-control"
              placeholder=" "
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
              style={{
                borderRadius: 10,
                border: "2px solid #e5e7eb",
                fontSize: 15,
                padding: "14px 14px 14px 44px",
                background: "#f8fafc",
                color: "#1a1a1a",
                transition: "all 0.3s ease",
                outline: "none",
                width: "100%"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.background = "#fff";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e5e7eb";
                e.target.style.background = "#f8fafc";
                e.target.style.boxShadow = "none";
              }}
            />
            <div style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
              fontSize: "16px"
            }}>
              📧
            </div>
            <label style={{
              position: "absolute",
              left: "44px",
              top: email ? "6px" : "50%",
              transform: email ? "translateY(0)" : "translateY(-50%)",
              fontSize: email ? "11px" : "15px",
              color: email ? "#667eea" : "#9ca3af",
              transition: "all 0.3s ease",
              pointerEvents: "none",
              background: email ? "#f8fafc" : "transparent",
              padding: email ? "0 3px" : "0"
            }}>
              Email
            </label>
          </div>

          <div style={{ position: "relative", marginBottom: 18 }}>
            <input
              className="form-control"
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                borderRadius: 10,
                border: "2px solid #e5e7eb",
                fontSize: 15,
                padding: "14px 44px 14px 44px",
                background: "#f8fafc",
                color: "#1a1a1a",
                transition: "all 0.3s ease",
                outline: "none",
                width: "100%"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.background = "#fff";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e5e7eb";
                e.target.style.background = "#f8fafc";
                e.target.style.boxShadow = "none";
              }}
            />
            <div style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
              fontSize: "16px"
            }}>
              🔒
            </div>
            <label style={{
              position: "absolute",
              left: "44px",
              top: password ? "6px" : "50%",
              transform: password ? "translateY(0)" : "translateY(-50%)",
              fontSize: password ? "11px" : "15px",
              color: password ? "#667eea" : "#9ca3af",
              transition: "all 0.3s ease",
              pointerEvents: "none",
              background: password ? "#f8fafc" : "transparent",
              padding: password ? "0 3px" : "0"
            }}>
              Contraseña
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#9ca3af",
                fontSize: "16px",
                cursor: "pointer",
                padding: "3px"
              }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {error && (
            <div style={{
              background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
              border: "1px solid #f87171",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13,
              marginBottom: 16,
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span>⚠️</span>
              {error}
            </div>
          )}

          <button
            className="btn w-100"
            type="submit"
            disabled={loading}
            style={{
              borderRadius: 10,
              fontWeight: 600,
              background: loading ? "#9ca3af" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
              transition: "all 0.3s ease",
              padding: "14px",
              fontSize: "15px",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 16px rgba(102, 126, 234, 0.3)",
              transform: loading ? "none" : "translateY(0)"
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 16px rgba(102, 126, 234, 0.3)";
              }
            }}
          >
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <div style={{
                  width: "18px",
                  height: "18px",
                  border: "2px solid #fff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}></div>
                Entrando...
              </div>
            ) : (
              "🚀 Entrar"
            )}
          </button>
        </form>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        
        #root {
          margin: 0 !important;
          padding: 0 !important;
          height: 100vh !important;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Login;