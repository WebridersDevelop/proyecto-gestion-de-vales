import { useState } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Form, Button, Card, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

function CrearUsuario() {
  const { rol } = useAuth();
  const [email, setEmail] = useState('');
  const [uid, setUid] = useState('');
  const [rolUsuario, setRolUsuario] = useState('peluquero');
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Solo admin puede ver este formulario
  if (rol !== 'admin') return <Alert variant="danger">No autorizado</Alert>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !uid || !rolUsuario || !nombre) {
      setMensaje('Completa todos los campos');
      return;
    }
    try {
      // Crea el documento en la colección usuarios con el UID como ID
      await setDoc(doc(collection(db, 'usuarios'), uid), {
        email,
        nombre,
        rol: rolUsuario
      });
      setMensaje('¡Usuario creado correctamente!');
      setEmail('');
      setUid('');
      setRolUsuario('peluquero');
      setNombre('');
    } catch (err) {
      setMensaje('Error al crear usuario');
    }
    setTimeout(() => setMensaje(''), 3000);
  };

  return (
    <Row className="justify-content-center mt-4">
      <Col xs={12} md={8} lg={6}>
        <Card>
          <Card.Body>
            <Card.Title className="mb-4 text-center">Crear Usuario</Card.Title>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="uid">
                <Form.Label>UID (de Firebase Auth)</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="UID del usuario"
                  value={uid}
                  onChange={e => setUid(e.target.value)}
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
              <Form.Group className="mb-3" controlId="rolUsuario">
                <Form.Label>Rol</Form.Label>
                <Form.Select value={rolUsuario} onChange={e => setRolUsuario(e.target.value)}>
                  <option value="peluquero">Peluquero</option>
                  <option value="admin">Administrador</option>
                </Form.Select>
              </Form.Group>
              <div className="d-grid">
                <Button variant="success" type="submit">
                  Crear Usuario
                </Button>
              </div>
              {mensaje && <Alert className="mt-3" variant="info">{mensaje}</Alert>}
            </Form>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default CrearUsuario;