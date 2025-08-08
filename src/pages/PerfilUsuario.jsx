import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, Form, Button, Alert, Container, Row, Col } from 'react-bootstrap';

function PerfilUsuario() {
  const { user, nombre, logout } = useAuth();
  const [nombreForm, setNombreForm] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [datosUsuario, setDatosUsuario] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      cargarDatosUsuario();
    }
  }, [user, cargarDatosUsuario]);

  const cargarDatosUsuario = useCallback(async () => {
    try {
      const docRef = doc(db, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDatosUsuario(data);
        setNombreForm(data.nombre || '');
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  }, [user]);

  const actualizarNombre = async (e) => {
    e.preventDefault();
    if (!nombreForm.trim()) {
      setMensaje('El nombre no puede estar vacío');
      return;
    }

    setLoading(true);
    setMensaje('');

    try {
      const docRef = doc(db, 'usuarios', user.uid);
      await updateDoc(docRef, {
        nombre: nombreForm.trim()
      });
      
      setMensaje('✅ Nombre actualizado correctamente');
      
      // Recargar la página después de 2 segundos para actualizar el contexto
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error al actualizar:', error);
      setMensaje('❌ Error al actualizar el nombre');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Container className="mt-5">
        <Alert variant="warning">Debes iniciar sesión para ver tu perfil</Alert>
      </Container>
    );
  }

  return (
    <Container style={{ 
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh',
      padding: '40px 20px'
    }}>
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={6}>
          <Card className="shadow-lg border-0" style={{
            borderRadius: 24,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <Card.Body className="p-0">
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                padding: '24px',
                color: 'white',
                borderRadius: '24px 24px 0 0'
              }}>
                <h3 className="mb-1 fw-bold text-center">
                  <i className="bi bi-person-circle me-2"></i>
                  Mi Perfil
                </h3>
                <p className="mb-0 opacity-90 text-center">
                  Información de tu cuenta
                </p>
              </div>

              <div style={{ padding: '24px' }}>
                {/* Información actual */}
                <div className="mb-4">
                  <h6 style={{ color: '#374151', fontWeight: 600, marginBottom: '16px' }}>
                    Información Actual:
                  </h6>
                  <div style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div className="mb-2">
                      <strong>Email:</strong> {user.email}
                    </div>
                    <div className="mb-2">
                      <strong>Nombre:</strong> 
                      <span style={{ 
                        color: nombre && nombre !== 'Usuario sin nombre' ? '#22c55e' : '#dc3545',
                        fontWeight: 600,
                        marginLeft: '8px'
                      }}>
                        {nombre || 'No configurado'}
                      </span>
                    </div>
                    <div className="mb-0">
                      <strong>Rol:</strong> {datosUsuario?.rol || 'No asignado'}
                    </div>
                  </div>
                </div>

                {/* Formulario para actualizar nombre */}
                {(!nombre || nombre === 'Usuario sin nombre') && (
                  <Alert variant="warning" className="mb-4">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    <strong>Atención:</strong> Tu nombre no está configurado correctamente. 
                    Por favor, actualízalo para que aparezca en los vales.
                  </Alert>
                )}

                <Form onSubmit={actualizarNombre}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{ 
                      fontWeight: 600, 
                      color: '#374151', 
                      fontSize: '0.95rem'
                    }}>
                      <i className="bi bi-person me-2"></i>
                      Actualizar Nombre
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={nombreForm}
                      onChange={(e) => setNombreForm(e.target.value)}
                      placeholder="Escribe tu nombre completo"
                      style={{
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </Form.Group>

                  <Button
                    type="submit"
                    disabled={loading || !nombreForm.trim()}
                    style={{
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontWeight: 600,
                      width: '100%'
                    }}
                  >
                    {loading ? (
                      <>
                        <i className="bi bi-arrow-repeat spin me-2"></i>
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Actualizar Nombre
                      </>
                    )}
                  </Button>
                </Form>

                {mensaje && (
                  <Alert 
                    variant={mensaje.includes('✅') ? 'success' : 'danger'} 
                    className="mt-3 mb-4"
                    style={{ borderRadius: '12px' }}
                  >
                    {mensaje}
                  </Alert>
                )}

                {/* Botón de cerrar sesión */}
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <Button
                    variant="outline-danger"
                    onClick={logout}
                    style={{
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontWeight: 600,
                      width: '100%',
                      border: '2px solid #dc3545'
                    }}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Cerrar Sesión
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default PerfilUsuario;
