import { useState } from 'react';

function ValeServicioForm({ onSubmit }) {
  const [peluquero, setPeluquero] = useState('');
  const [servicio, setServicio] = useState('');
  const [valor, setValor] = useState('');
  const [fecha, setFecha] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!peluquero || !servicio || !valor || !fecha) return;
    onSubmit({ peluquero, servicio, valor: Number(valor), fecha, estado: 'pendiente' });
    setPeluquero('');
    setServicio('');
    setValor('');
    setFecha('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Peluquero"
          value={peluquero}
          onChange={e => setPeluquero(e.target.value)}
          required
        />
      </div>
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Servicio"
          value={servicio}
          onChange={e => setServicio(e.target.value)}
          required
        />
      </div>
      <div className="mb-3">
        <input
          type="number"
          className="form-control"
          placeholder="Valor"
          value={valor}
          onChange={e => setValor(e.target.value)}
          required
        />
      </div>
      <div className="mb-3">
        <input
          type="datetime-local"
          className="form-control"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="btn btn-primary">Registrar Vale</button>
    </form>
  );
}

export default ValeServicioForm;