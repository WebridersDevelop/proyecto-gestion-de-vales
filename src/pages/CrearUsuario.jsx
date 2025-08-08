import { useState } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Form, Button, Card, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';

function CrearUsuario() {
  const { rol } = useAuth();
  const [email, setEmail] = useState('');
  const [uid, setUid] = useState('');
  const [rolUsuario, setRolUsuario] = useState('barbero'); // Valor inicial corregido
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  // Solo admin puede ver este formulario
  if (rol !== 'admin') return <Alert variant="danger" className="mt-4 text-center">No autorizado</Alert>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !uid || !rolUsuario || !nombre) {
      setMensaje('Completa todos los campos');
      setTimeout(() => setMensaje(''), 3000);
      return;
    }
    setLoading(true);
    try {
      await setDoc(doc(collection(db, 'usuarios'), uid), {
        email,
        nombre,
        rol: rolUsuario
      });
      setMensaje('¡Usuario creado correctamente!');
      setEmail('');
      setUid('');
      setRolUsuario('barbero'); // Valor de reseteo corregido
      setNombre('');
    } catch (error) {
      console.error('Error al crear usuario:', error);
      setMensaje('Error al crear usuario');
    }
    setLoading(false);
    setTimeout(() => setMensaje(''), 3000);
  };

  return (
    <Row className="justify-content-center mt-4">
      <Col xs={12} md={8} lg={6} xl={5}>
        <Card className="shadow-sm border-0" style={{borderRadius: 18}}>
          <Card.Body>
            <Card.Title className="mb-4 text-center" style={{fontWeight: 700, letterSpacing: '-1px', fontSize: 24, color: "#6366f1"}}>
              <i className="bi bi-person-plus me-2"></i>Crear Usuario
            </Card.Title>
            <Form onSubmit={handleSubmit} className="p-2" style={{background: "#f9fafb", borderRadius: 12}}>
              <Form.Group className="mb-3" controlId="uid">
                <Form.Label>UID (de Firebase Auth)</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="UID del usuario"
                  value={uid}
                  onChange={e => setUid(e.target.value)}
                  autoFocus
                />
                <Form.Text>
                  El UID se obtiene al registrar el usuario en Firebase Authentication.
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-3" controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Correo del usuario"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="nombre">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Nombre del usuario"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-4" controlId="rolUsuario">
                <Form.Label>Rol</Form.Label>
                <Form.Select value={rolUsuario} onChange={e => setRolUsuario(e.target.value)}>
                  <option value="barbero">Barbero</option>
                  <option value="estilista">Estilista</option>
                  <option value="estetica">Estética</option>
                  <option value="anfitrion">Anfitrión</option>
                  <option value="admin">Administrador</option>
                </Form.Select>
              </Form.Group>
              <div className="d-grid">
                <Button
                  variant="success"
                  type="submit"
                  disabled={loading}
                  style={{background: '#16a34a', borderColor: '#16a34a', fontWeight: 600, fontSize: 17}}
                >
                  {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Creando...</> : <><i className="bi bi-person-plus me-1"></i>Crear Usuario</>}
                </Button>
              </div>
              {mensaje && (
                <Alert className="mt-3 mb-0" variant={mensaje.startsWith('¡') ? 'success' : 'danger'}>
                  {mensaje}
                </Alert>
              )}
            </Form>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default CrearUsuario;