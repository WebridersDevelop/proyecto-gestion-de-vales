import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, getDocs, updateDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, Row, Col, Spinner, Alert, Table, Form, Button, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Componente de paginación
const PaginacionComponente = ({ paginaActual, totalPaginas, totalItems, onCambioPagina, elementosPorPagina }) => {
  if (totalPaginas <= 1) return null;

  const getPaginasVisibles = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, paginaActual - delta); i <= Math.min(totalPaginas - 1, paginaActual + delta); i++) {
      range.push(i);
    }

    if (paginaActual - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (paginaActual + delta < totalPaginas - 1) {
      rangeWithDots.push('...', totalPaginas);
    } else {
      rangeWithDots.push(totalPaginas);
    }

    return rangeWithDots;
  };

  const startItem = (paginaActual - 1) * elementosPorPagina + 1;
  const endItem = Math.min(paginaActual * elementosPorPagina, totalItems);

  return (
    <div className="d-flex justify-content-between align-items-center mt-3 p-3" style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
      {/* Información de paginación */}
      <div style={{ fontSize: '12px', color: '#64748b' }}>
        Mostrando {startItem}-{endItem} de {totalItems} registros
      </div>

      {/* Controles de paginación */}
      <div className="d-flex align-items-center gap-1">
        {/* Botón anterior */}
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => onCambioPagina(paginaActual - 1)}
          disabled={paginaActual === 1}
          style={{ fontSize: '11px', padding: '4px 8px', minWidth: '32px' }}
        >
          ‹
        </Button>

        {/* Números de página */}
        {getPaginasVisibles().map((pagina, index) => (
          <span key={index}>
            {pagina === '...' ? (
              <span style={{ padding: '4px 8px', fontSize: '11px', color: '#64748b' }}>...</span>
            ) : (
              <Button
                variant={pagina === paginaActual ? "primary" : "outline-secondary"}
                size="sm"
                onClick={() => onCambioPagina(pagina)}
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 8px', 
                  minWidth: '32px',
                  fontWeight: pagina === paginaActual ? 600 : 400
                }}
              >
                {pagina}
              </Button>
            )}
          </span>
        ))}

        {/* Botón siguiente */}
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => onCambioPagina(paginaActual + 1)}
          disabled={paginaActual === totalPaginas}
          style={{ fontSize: '11px', padding: '4px 8px', minWidth: '32px' }}
        >
          ›
        </Button>
      </div>
    </div>
  );
};

// Componente de lista compacta para móvil (ideal para alto volumen)
const ListaCompactaVale = ({ vale, editandoVale, valoresEditados, handleCambioValor, nombresUsuarios, guardarEdicion, cancelarEdicion, setEditandoVale, handleEliminar, rol }) => {
  const montoPercibido = vale.tipo === 'Ingreso' && vale.estado === 'aprobado' 
    ? (() => {
        let porcentajeProfesional = 50;
        if (vale.dividirPorDos) {
          if (typeof vale.dividirPorDos === 'string') {
            porcentajeProfesional = parseFloat(vale.dividirPorDos) || 50;
          } else {
            porcentajeProfesional = 50;
          }
        } else {
          porcentajeProfesional = 100;
        }
        const monto = parseFloat(vale.valor || vale.monto) || 0;
        const comisionExtra = parseFloat(vale.comisionExtra) || 0;
        return ((monto * porcentajeProfesional / 100) + comisionExtra).toFixed(0);
      })()
    : '0';

  return (
    <div 
      className="mb-2 p-2"
      style={{
        border: `1px solid ${
          editandoVale === vale.id 
            ? '#6366f1' 
            : vale.estado === 'aprobado'
            ? '#22c55e'
            : vale.estado === 'rechazado'
            ? '#dc3545'
            : '#f59e42'
        }`,
        borderRadius: 8,
        background: editandoVale === vale.id 
          ? '#f8fafc' 
          : vale.estado === 'rechazado'
          ? '#fef2f2'
          : vale.estado === 'aprobado'
          ? '#f0fdf4'
          : '#fffbeb',
        borderLeft: `4px solid ${
          vale.estado === 'aprobado' ? '#22c55e' : 
          vale.estado === 'rechazado' ? '#dc3545' : '#f59e42'
        }`
      }}
    >
      {/* Primera línea: Info principal */}
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div className="d-flex align-items-center gap-2 flex-grow-1">
          {/* Badges compactos con mejor visibilidad */}
          <span 
            className={`badge d-flex align-items-center justify-content-center ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`} 
            style={{ 
              fontSize: '8px', 
              padding: '3px 6px',
              minHeight: '16px',
              lineHeight: '1',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {vale.tipo === 'Ingreso' ? '↗ ING' : '↙ EGR'}
          </span>
          
          {/* Nombre del profesional */}
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {editandoVale === vale.id ? (
              <CeldaEditableExterna
                esEditable={true}
                valorActual={valoresEditados.peluquero !== undefined ? valoresEditados.peluquero : (vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || 'Desconocido')}
                onCambio={valor => handleCambioValor('peluquero', valor)}
                tipo="text"
              />
            ) : (vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || 'Desconocido')}
          </div>
          
          {/* Servicio */}
          <div style={{ fontSize: '12px', color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {editandoVale === vale.id ? (
              <CeldaEditableExterna
                esEditable={true}
                valorActual={valoresEditados.servicio !== undefined ? valoresEditados.servicio : (vale.servicio || vale.concepto || 'Sin descripción')}
                onCambio={valor => handleCambioValor('servicio', valor)}
                tipo="text"
              />
            ) : (vale.servicio || vale.concepto || 'Sin descripción')}
          </div>
        </div>
        
        {/* Monto y detalles financieros */}
        <div className="text-end">
          <div style={{ fontSize: '14px', fontWeight: 700, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545' }}>
            ${vale.valor || vale.monto || '0'}
          </div>
          
          {/* Información financiera para ingresos */}
          {vale.tipo === 'Ingreso' && (
            <div style={{ fontSize: '9px', color: '#64748b' }}>
              {(() => {
                const porcentaje = vale.dividirPorDos 
                  ? (typeof vale.dividirPorDos === 'string' ? vale.dividirPorDos : '50')
                  : '100';
                const comisionExtra = parseFloat(vale.comisionExtra) || 0;
                
                return (
                  <>
                    <div>{porcentaje}% peluquero{comisionExtra > 0 ? ` +$${comisionExtra} extra` : ''}</div>
                    {vale.estado === 'aprobado' && (
                      <div style={{ fontWeight: 600, color: '#22c55e' }}>
                        Recibe: ${montoPercibido}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          
          {/* Hora */}
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Segunda línea: Detalles adicionales y acciones */}
      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2" style={{ fontSize: '10px', color: '#64748b', flexWrap: 'wrap' }}>
          {/* Estado con mejor alineación */}
          <span 
            className={`badge d-flex align-items-center justify-content-center ${
              vale.estado === 'aprobado' ? 'bg-success' : 
              vale.estado === 'rechazado' ? 'bg-danger' : 'bg-warning text-dark'
            }`} 
            style={{ 
              fontSize: '9px', 
              padding: '3px 6px',
              minHeight: '18px',
              lineHeight: '1',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {vale.estado === 'aprobado' ? '✓ APROBADO' : 
             vale.estado === 'rechazado' ? '✗ RECHAZADO' : '⏳ PENDIENTE'}
          </span>
          
          {/* Información adicional compacta con mejor espaciado */}
          <div className="d-flex align-items-center gap-2" style={{ fontSize: '10px' }}>
            {vale.formaPago && (
              <span style={{ 
                background: '#f1f5f9', 
                padding: '2px 6px', 
                borderRadius: 4, 
                color: '#475569',
                fontWeight: 500
              }}>
                {vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1)}
              </span>
            )}
            {vale.local && (
              <span style={{ 
                background: '#f1f5f9', 
                padding: '2px 6px', 
                borderRadius: 4, 
                color: '#475569',
                fontWeight: 500
              }}>
                📍 {vale.local}
              </span>
            )}
            {vale.tipo === 'Ingreso' && vale.estado === 'aprobado' && (
              <span style={{ 
                background: '#dcfce7', 
                padding: '2px 6px', 
                borderRadius: 4, 
                color: '#166534',
                fontWeight: 600
              }}>
                💵 Recibe ${montoPercibido}
              </span>
            )}
            {vale.codigo && (
              <span style={{ 
                background: '#e0e7ff', 
                padding: '2px 6px', 
                borderRadius: 4, 
                color: '#3730a3',
                fontWeight: 500
              }}>
                #{vale.codigo}
              </span>
            )}
          </div>
        </div>

        {/* Botones de acción compactos */}
        <div className="d-flex gap-1">
          {editandoVale === vale.id ? (
            <>
              <Button 
                size="sm" 
                variant="success"
                onClick={() => guardarEdicion(vale)}
                style={{ fontSize: '9px', padding: '2px 6px', minWidth: '24px', minHeight: '24px' }}
              >
                ✓
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={cancelarEdicion}
                style={{ fontSize: '9px', padding: '2px 6px', minWidth: '24px', minHeight: '24px' }}
              >
                ✕
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                variant="outline-primary"
                onClick={() => setEditandoVale(vale.id)}
                style={{ fontSize: '9px', padding: '2px 6px', minWidth: '24px', minHeight: '24px' }}
              >
                ✎
              </Button>
              {(rol === 'admin' || rol === 'anfitrion') && (
                <Button 
                  size="sm" 
                  variant="outline-danger"
                  onClick={() => handleEliminar(vale.id)}
                  style={{ fontSize: '9px', padding: '2px 6px', minWidth: '24px', minHeight: '24px' }}
                >
                  🗑
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fila de edición expandida (solo si está editando) */}
      {editandoVale === vale.id && (
        <div className="mt-2 pt-2 border-top" style={{ borderTopColor: '#e5e7eb !important' }}>
          <div className="row g-2" style={{ fontSize: '11px' }}>
            <div className="col-6">
              <label className="form-label mb-1" style={{ fontSize: '9px', fontWeight: 600, color: '#64748b' }}>Fecha:</label>
              <CeldaEditableExterna
                esEditable={true}
                valorActual={valoresEditados.fecha !== undefined ? valoresEditados.fecha : vale.fecha.toLocaleDateString('es-ES')}
                onCambio={valor => handleCambioValor('fecha', valor)}
                tipo="date"
              />
            </div>
            <div className="col-6">
              <label className="form-label mb-1" style={{ fontSize: '9px', fontWeight: 600, color: '#64748b' }}>Pago:</label>
              <CeldaEditableExterna
                esEditable={true}
                valorActual={valoresEditados.formaPago !== undefined ? valoresEditados.formaPago : vale.formaPago}
                onCambio={valor => handleCambioValor('formaPago', valor)}
                opciones={[
                  {value: 'efectivo', label: 'Efectivo'},
                  {value: 'tarjeta', label: 'Tarjeta'},
                  {value: 'transferencia', label: 'Transferencia'},
                  {value: 'mixto', label: 'Mixto'}
                ]}
              />
            </div>
            {vale.tipo === 'Ingreso' && (
              <div className="col-6">
                <label className="form-label mb-1" style={{ fontSize: '9px', fontWeight: 600, color: '#64748b' }}>% Prof:</label>
                <CeldaEditableExterna
                  esEditable={true}
                  valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (() => {
                    if (vale.dividirPorDos) {
                      if (typeof vale.dividirPorDos === 'string') {
                        return vale.dividirPorDos;
                      } else {
                        return '50';
                      }
                    } else {
                      return '100';
                    }
                  })()}
                  onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                  opciones={[
                    {value: '100', label: '100%'},
                    {value: '50', label: '50%'},
                    {value: '40', label: '40%'},
                    {value: '30', label: '30%'}
                  ]}
                />
              </div>
            )}
            <div className="col-6">
              <label className="form-label mb-1" style={{ fontSize: '9px', fontWeight: 600, color: '#64748b' }}>Local:</label>
              <CeldaEditableExterna
                esEditable={true}
                valorActual={valoresEditados.local !== undefined ? valoresEditados.local : vale.local}
                onCambio={valor => handleCambioValor('local', valor)}
                tipo="text"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente de tarjeta para desktop y tablet (optimizado para pantallas grandes)
const TarjetaValeDesktop = ({ vale, editandoVale, valoresEditados, handleCambioValor, nombresUsuarios, guardarEdicion, cancelarEdicion, setEditandoVale, handleEliminar, rol, screenSize }) => {
  const montoPercibido = vale.tipo === 'Ingreso' && vale.estado === 'aprobado' 
    ? (() => {
        let porcentajeProfesional = 50;
        if (vale.dividirPorDos) {
          if (typeof vale.dividirPorDos === 'string') {
            porcentajeProfesional = parseFloat(vale.dividirPorDos) || 50;
          } else {
            porcentajeProfesional = 50;
          }
        } else {
          porcentajeProfesional = 100;
        }
        const monto = parseFloat(vale.valor || vale.monto) || 0;
        const comisionExtra = parseFloat(vale.comisionExtra) || 0;
        return ((monto * porcentajeProfesional / 100) + comisionExtra).toFixed(0);
      })()
    : '0';

  const isDesktop = screenSize.isDesktop;
  const cardWidth = isDesktop ? '100%' : '100%';
  const cardLayout = isDesktop ? 'horizontal' : 'vertical';

  return (
    <Card 
      className="mb-3"
      style={{
        border: `2px solid ${
          editandoVale === vale.id 
            ? '#6366f1' 
            : vale.estado === 'aprobado'
            ? '#22c55e'
            : vale.estado === 'rechazado'
            ? '#dc3545'
            : '#f59e42'
        }`,
        borderRadius: 16,
        boxShadow: editandoVale === vale.id 
          ? '0 8px 32px rgba(99, 102, 241, 0.2)' 
          : '0 4px 16px rgba(0,0,0,0.08)',
        background: editandoVale === vale.id 
          ? '#f8fafc' 
          : vale.estado === 'rechazado'
          ? '#fef2f2'
          : vale.estado === 'aprobado'
          ? '#f0fdf4'
          : '#fffbeb',
        width: cardWidth,
        transition: 'all 0.3s ease',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        if (editandoVale !== vale.id) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (editandoVale !== vale.id) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        }
      }}
    >
      <Card.Body style={{ padding: isDesktop ? '20px' : '16px' }}>
        {/* Layout horizontal para desktop, vertical para tablet */}
        <div className={`d-flex ${cardLayout === 'horizontal' ? 'flex-row' : 'flex-column'} gap-3`}>
          
          {/* Columna izquierda - Información principal */}
          <div className={`${cardLayout === 'horizontal' ? 'flex-grow-1' : 'w-100'}`}>
            {/* Header con badges */}
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="d-flex align-items-center gap-2">
                <span 
                  className={`badge d-flex align-items-center justify-content-center ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`} 
                  style={{ 
                    fontSize: '11px', 
                    padding: '6px 12px',
                    minHeight: '24px',
                    lineHeight: '1',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {vale.tipo === 'Ingreso' ? '↗ INGRESO' : '↙ EGRESO'}
                </span>
                <span 
                  className={`badge d-flex align-items-center justify-content-center ${
                    vale.estado === 'aprobado' ? 'bg-success' : 
                    vale.estado === 'rechazado' ? 'bg-danger' : 'bg-warning text-dark'
                  }`} 
                  style={{ 
                    fontSize: '11px', 
                    padding: '6px 12px',
                    minHeight: '24px',
                    lineHeight: '1',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {vale.estado === 'aprobado' ? '✓ APROBADO' : 
                   vale.estado === 'rechazado' ? '✗ RECHAZADO' : '⏳ PENDIENTE'}
                </span>
                {vale.codigo && (
                  <span 
                    className="badge bg-secondary d-flex align-items-center justify-content-center" 
                    style={{ 
                      fontSize: '10px', 
                      padding: '4px 8px',
                      minHeight: '22px',
                      lineHeight: '1',
                      fontWeight: 500
                    }}
                  >
                    #{vale.codigo}
                  </span>
                )}
              </div>
            </div>

            {/* Información del profesional y servicio */}
            <div className="mb-3">
              <div style={{ fontSize: isDesktop ? '18px' : '16px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                <CeldaEditableExterna
                  esEditable={editandoVale === vale.id}
                  valorActual={valoresEditados.peluquero !== undefined ? valoresEditados.peluquero : (vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || 'Desconocido')}
                  onCambio={valor => handleCambioValor('peluquero', valor)}
                  tipo="text"
                />
              </div>
              <div style={{ fontSize: isDesktop ? '15px' : '14px', fontWeight: 500, color: '#64748b' }}>
                <CeldaEditableExterna
                  esEditable={editandoVale === vale.id}
                  valorActual={valoresEditados.servicio !== undefined ? valoresEditados.servicio : (vale.servicio || vale.concepto || 'Sin descripción')}
                  onCambio={valor => handleCambioValor('servicio', valor)}
                  tipo="text"
                />
              </div>
            </div>

            {/* Detalles en grid para desktop */}
            {isDesktop && (
              <div className="row g-3 mb-3">
                <div className="col-4">
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>📅 Fecha</div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    <CeldaEditableExterna
                      esEditable={editandoVale === vale.id}
                      valorActual={valoresEditados.fecha !== undefined ? valoresEditados.fecha : vale.fecha.toLocaleDateString('es-ES')}
                      onCambio={valor => handleCambioValor('fecha', valor)}
                      tipo="date"
                    />
                  </div>
                </div>
                <div className="col-4">
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>🕒 Hora</div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="col-4">
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>💳 Pago</div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    <CeldaEditableExterna
                      esEditable={editandoVale === vale.id}
                      valorActual={valoresEditados.formaPago !== undefined ? valoresEditados.formaPago : (vale.formaPago || 'No especificado')}
                      onCambio={valor => handleCambioValor('formaPago', valor)}
                      opciones={[
                        {value: 'efectivo', label: 'Efectivo'},
                        {value: 'tarjeta', label: 'Tarjeta'},
                        {value: 'transferencia', label: 'Transferencia'},
                        {value: 'mixto', label: 'Mixto'}
                      ]}
                    />
                  </div>
                </div>
                {vale.local && (
                  <div className="col-4">
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>📍 Local</div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>
                      <CeldaEditableExterna
                        esEditable={editandoVale === vale.id}
                        valorActual={valoresEditados.local !== undefined ? valoresEditados.local : vale.local}
                        onCambio={valor => handleCambioValor('local', valor)}
                        tipo="text"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columna derecha - Información financiera */}
          <div className={`${cardLayout === 'horizontal' ? 'flex-shrink-0' : 'w-100'}`} style={{ minWidth: cardLayout === 'horizontal' ? '280px' : 'auto' }}>
            {/* Monto principal */}
            <div className="text-center mb-3" style={{ 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
              borderRadius: 12,
              padding: isDesktop ? '20px' : '16px'
            }}>
              <div style={{ fontSize: isDesktop ? '24px' : '20px', fontWeight: 800, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', marginBottom: '8px' }}>
                ${vale.valor || vale.monto || '0'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Monto {vale.tipo === 'Ingreso' ? 'de Ingreso' : 'de Egreso'}
              </div>
            </div>

            {/* Información financiera detallada para ingresos */}
            {vale.tipo === 'Ingreso' && (
              <div className="mb-3">
                {(() => {
                  const porcentaje = vale.dividirPorDos 
                    ? (typeof vale.dividirPorDos === 'string' ? vale.dividirPorDos : '50')
                    : '100';
                  const comisionExtra = parseFloat(vale.comisionExtra) || 0;
                  
                  return (
                    <div style={{ 
                      background: 'rgba(34, 197, 94, 0.05)',
                      borderRadius: 12,
                      padding: '16px',
                      border: '1px solid rgba(34, 197, 94, 0.2)'
                    }}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span style={{ fontSize: '13px', color: '#64748b' }}>💸 Porcentaje para el peluquero</span>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#22c55e' }}>
                          <CeldaEditableExterna
                            esEditable={editandoVale === vale.id}
                            valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : porcentaje}
                            onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                            opciones={[
                              {value: '100', label: '100%'},
                              {value: '50', label: '50%'},
                              {value: '40', label: '40%'},
                              {value: '30', label: '30%'}
                            ]}
                          />
                        </div>
                      </div>
                      
                      {(comisionExtra > 0 || editandoVale === vale.id) && (
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span style={{ fontSize: '13px', color: '#64748b' }}>➕ Propina extra</span>
                          <div style={{ fontSize: '15px', fontWeight: 600, color: '#6366f1' }}>
                            <CeldaEditableExterna
                              esEditable={editandoVale === vale.id}
                              valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (comisionExtra || 0)}
                              onCambio={valor => handleCambioValor('comisionExtra', Number(valor) || 0)}
                              tipo="number"
                            />
                          </div>
                        </div>
                      )}
                      
                      {vale.estado === 'aprobado' && (
                        <div style={{ 
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: 8,
                          padding: '12px',
                          marginTop: '8px',
                          borderLeft: '4px solid #22c55e'
                        }}>
                          <div className="d-flex align-items-center justify-content-between">
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>💵 El peluquero recibe</span>
                            <span style={{ fontSize: isDesktop ? '18px' : '16px', fontWeight: 800, color: '#22c55e' }}>
                              ${montoPercibido}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Observaciones */}
            {(vale.observacion || editandoVale === vale.id) && (
              <div className="mb-3">
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>📝 Observaciones</div>
                <div style={{ 
                  background: '#f8fafc',
                  borderRadius: 8,
                  padding: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <CeldaEditableExterna
                    esEditable={editandoVale === vale.id}
                    valorActual={valoresEditados.observacion !== undefined ? valoresEditados.observacion : (vale.observacion || '')}
                    onCambio={valor => handleCambioValor('observacion', valor)}
                    tipo="text"
                  />
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="d-flex gap-2 justify-content-end">
              {editandoVale === vale.id ? (
                <>
                  <Button 
                    variant="success"
                    onClick={() => guardarEdicion(vale)}
                    style={{ 
                      fontSize: '13px', 
                      padding: '8px 16px',
                      fontWeight: 600,
                      borderRadius: 8
                    }}
                  >
                    ✓ Guardar Cambios
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={cancelarEdicion}
                    style={{ 
                      fontSize: '13px', 
                      padding: '8px 16px',
                      fontWeight: 600,
                      borderRadius: 8
                    }}
                  >
                    ✕ Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline-primary"
                    onClick={() => setEditandoVale(vale.id)}
                    style={{ 
                      fontSize: '13px', 
                      padding: '8px 16px',
                      fontWeight: 600,
                      borderRadius: 8
                    }}
                  >
                    ✎ Editar
                  </Button>
                  {(rol === 'admin' || rol === 'anfitrion') && (
                    <Button 
                      variant="outline-danger"
                      onClick={() => handleEliminar(vale.id)}
                      style={{ 
                        fontSize: '13px', 
                        padding: '8px 16px',
                        fontWeight: 600,
                        borderRadius: 8
                      }}
                    >
                      🗑 Eliminar
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

// Componente de tarjeta para móvil (para casos específicos)
const TarjetaVale = ({ vale, editandoVale, valoresEditados, handleCambioValor, nombresUsuarios, guardarEdicion, cancelarEdicion, setEditandoVale, handleEliminar, rol }) => {
  const montoPercibido = vale.tipo === 'Ingreso' && vale.estado === 'aprobado' 
    ? (() => {
        let porcentajeProfesional = 50;
        if (vale.dividirPorDos) {
          if (typeof vale.dividirPorDos === 'string') {
            porcentajeProfesional = parseFloat(vale.dividirPorDos) || 50;
          } else {
            porcentajeProfesional = 50;
          }
        } else {
          porcentajeProfesional = 100;
        }
        const monto = parseFloat(vale.valor || vale.monto) || 0;
        const comisionExtra = parseFloat(vale.comisionExtra) || 0;
        return ((monto * porcentajeProfesional / 100) + comisionExtra).toFixed(0);
      })()
    : '0';

  return (
    <Card 
      className="mb-3"
      style={{
        border: `2px solid ${
          editandoVale === vale.id 
            ? '#6366f1' 
            : vale.estado === 'aprobado'
            ? '#22c55e'
            : vale.estado === 'rechazado'
            ? '#dc3545'
            : '#f59e42'
        }`,
        borderRadius: 12,
        boxShadow: editandoVale === vale.id 
          ? '0 4px 12px rgba(99, 102, 241, 0.2)' 
          : '0 2px 8px rgba(0,0,0,0.1)',
        background: editandoVale === vale.id 
          ? '#f8fafc' 
          : vale.estado === 'rechazado'
          ? '#fef2f2'
          : vale.estado === 'aprobado'
          ? '#f0fdf4'
          : '#fffbeb'
      }}
    >
      <Card.Body style={{ padding: '12px' }}>
        {/* Header de la tarjeta */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span 
                className={`badge d-flex align-items-center justify-content-center ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`} 
                style={{ 
                  fontSize: '10px', 
                  padding: '4px 8px',
                  minHeight: '20px',
                  lineHeight: '1',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {vale.tipo === 'Ingreso' ? '↗ INGRESO' : '↙ EGRESO'}
              </span>
              <span 
                className={`badge d-flex align-items-center justify-content-center ${
                  vale.estado === 'aprobado' ? 'bg-success' : 
                  vale.estado === 'rechazado' ? 'bg-danger' : 'bg-warning text-dark'
                }`} 
                style={{ 
                  fontSize: '10px', 
                  padding: '4px 8px',
                  minHeight: '20px',
                  lineHeight: '1',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {vale.estado === 'aprobado' ? '✓ APROBADO' : 
                 vale.estado === 'rechazado' ? '✗ RECHAZADO' : '⏳ PENDIENTE'}
              </span>
              {vale.codigo && (
                <span 
                  className="badge bg-secondary d-flex align-items-center justify-content-center" 
                  style={{ 
                    fontSize: '9px', 
                    padding: '3px 6px',
                    minHeight: '18px',
                    lineHeight: '1',
                    fontWeight: 500
                  }}
                >
                  #{vale.codigo}
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
              <CeldaEditableExterna
                esEditable={editandoVale === vale.id}
                valorActual={valoresEditados.peluquero !== undefined ? valoresEditados.peluquero : (vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || 'Desconocido')}
                onCambio={valor => handleCambioValor('peluquero', valor)}
                tipo="text"
              />
            </div>
          </div>
          <div className="text-end">
            <div style={{ fontSize: '16px', fontWeight: 700, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545' }}>
              ${vale.valor || vale.monto || '0'}
            </div>
            
            {/* Información financiera detallada para ingresos */}
            {vale.tipo === 'Ingreso' && (
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.3', marginTop: '4px' }}>
                {(() => {
                  const porcentaje = vale.dividirPorDos 
                    ? (typeof vale.dividirPorDos === 'string' ? vale.dividirPorDos : '50')
                    : '100';
                  const comisionExtra = parseFloat(vale.comisionExtra) || 0;
                  
                  return (
                    <>
                      <div style={{ marginBottom: '2px' }}>
                        <span style={{ fontWeight: 500 }}>💸 {porcentaje}% para el peluquero</span>
                      </div>
                      
                      {comisionExtra > 0 && (
                        <div style={{ marginBottom: '2px', color: '#6366f1' }}>
                          <span style={{ fontWeight: 500 }}>➕ ${comisionExtra} propina extra</span>
                        </div>
                      )}
                      
                      {vale.estado === 'aprobado' && (
                        <div style={{ 
                          fontWeight: 700, 
                          color: '#22c55e',
                          fontSize: '12px',
                          padding: '2px 6px',
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: 4,
                          marginTop: '2px'
                        }}>
                          💵 El peluquero recibe: ${montoPercibido}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Información principal */}
        <div className="mb-2">
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
            <CeldaEditableExterna
              esEditable={editandoVale === vale.id}
              valorActual={valoresEditados.servicio !== undefined ? valoresEditados.servicio : (vale.servicio || vale.concepto || 'Sin descripción')}
              onCambio={valor => handleCambioValor('servicio', valor)}
              tipo="text"
            />
          </div>
        </div>

        {/* Detalles secundarios */}
        <div className="row g-2 mb-2" style={{ fontSize: '12px', color: '#64748b' }}>
          <div className="col-6">
            <strong>Fecha:</strong> 
            <CeldaEditableExterna
              esEditable={editandoVale === vale.id}
              valorActual={valoresEditados.fecha !== undefined ? valoresEditados.fecha : vale.fecha.toLocaleDateString('es-ES')}
              onCambio={valor => handleCambioValor('fecha', valor)}
              tipo="date"
            />
          </div>
          <div className="col-6">
            <strong>Hora:</strong> {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          {vale.formaPago && (
            <div className="col-6">
              <strong>Pago:</strong> 
              <CeldaEditableExterna
                esEditable={editandoVale === vale.id}
                valorActual={valoresEditados.formaPago !== undefined ? valoresEditados.formaPago : vale.formaPago}
                onCambio={valor => handleCambioValor('formaPago', valor)}
                opciones={[
                  {value: 'efectivo', label: 'Efectivo'},
                  {value: 'tarjeta', label: 'Tarjeta'},
                  {value: 'transferencia', label: 'Transferencia'},
                  {value: 'mixto', label: 'Mixto'}
                ]}
              />
            </div>
          )}
          {vale.local && (
            <div className="col-6">
              <strong>Local:</strong> 
              <CeldaEditableExterna
                esEditable={editandoVale === vale.id}
                valorActual={valoresEditados.local !== undefined ? valoresEditados.local : vale.local}
                onCambio={valor => handleCambioValor('local', valor)}
                tipo="text"
              />
            </div>
          )}
          {vale.tipo === 'Ingreso' && (
            <div className="col-6">
              <strong>% Prof:</strong> 
              <CeldaEditableExterna
                esEditable={editandoVale === vale.id}
                valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (() => {
                  if (vale.dividirPorDos) {
                    if (typeof vale.dividirPorDos === 'string') {
                      return vale.dividirPorDos;
                    } else {
                      return '50';
                    }
                  } else {
                    return '100';
                  }
                })()}
                onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                opciones={[
                  {value: '100', label: '100%'},
                  {value: '50', label: '50%'},
                  {value: '40', label: '40%'},
                  {value: '30', label: '30%'}
                ]}
              />
            </div>
          )}
          {vale.comisionExtra && parseFloat(vale.comisionExtra) > 0 && (
            <div className="col-6">
              <strong>Comisión Extra:</strong> ${vale.comisionExtra}
            </div>
          )}
        </div>

        {/* Observaciones */}
        {(vale.observacion || editandoVale === vale.id) && (
          <div className="mb-2">
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              <strong>Observación:</strong>
            </div>
            <div style={{ fontSize: '12px' }}>
              <CeldaEditableExterna
                esEditable={editandoVale === vale.id}
                valorActual={valoresEditados.observacion !== undefined ? valoresEditados.observacion : (vale.observacion || '')}
                onCambio={valor => handleCambioValor('observacion', valor)}
                tipo="text"
              />
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="d-flex gap-2 justify-content-end">
          {editandoVale === vale.id ? (
            <>
              <Button 
                size="sm" 
                variant="success"
                onClick={() => guardarEdicion(vale)}
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                ✓ Guardar
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={cancelarEdicion}
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                ✕ Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                variant="outline-primary"
                onClick={() => setEditandoVale(vale.id)}
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                ✎ Editar
              </Button>
              {(rol === 'admin' || rol === 'anfitrion') && (
                <Button 
                  size="sm" 
                  variant="outline-danger"
                  onClick={() => handleEliminar(vale.id)}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  🗑 Eliminar
                </Button>
              )}
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

// Componente separado para edición de celdas
const CeldaEditableExterna = ({ esEditable, valorActual, onCambio, tipo = 'text', opciones = null }) => {
  if (!esEditable) {
    return <span>{valorActual || '-'}</span>;
  }

  if (opciones) {
    return (
      <Form.Select
        size="sm"
        value={valorActual || ''}
        onChange={e => onCambio(e.target.value)}
        style={{ fontSize: 12, minWidth: 100 }}
      >
        <option value="">-</option>
        {opciones.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Form.Select>
    );
  }

  if (tipo === 'checkbox') {
    return (
      <Form.Check
        type="checkbox"
        checked={valorActual === true || valorActual === 'true'}
        onChange={e => onCambio(e.target.checked)}
      />
    );
  }

  return (
    <Form.Control
      size="sm"
      type={tipo}
      value={valorActual || ''}
      onChange={e => onCambio(e.target.value)}
      style={{ 
        fontSize: 12, 
        minWidth: tipo === 'number' ? 80 : 120,
        padding: '2px 6px'
      }}
      autoComplete="off"
    />
  );
};

function CuadreDiario() {
  const [vales, setVales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState({ usuario: '', tipo: '', estado: '', local: '', formaPago: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [nombresUsuarios, setNombresUsuarios] = useState({});
  const { rol } = useAuth();
  const [vista, setVista] = useState('cards'); // <-- Por Profesional es la vista por defecto
  const [modoVisualizacion, setModoVisualizacion] = useState('auto'); // auto, table, cards, list
  const [paginaActual, setPaginaActual] = useState(1);
  const [elementosPorPagina] = useState(15); // Configurable
  const [ordenColumna, _setOrdenColumna] = useState('fecha');
  const [ordenDireccion, setOrdenDireccion] = useState('desc');
  
  // Hook para detectar tamaño de pantalla con breakpoints mejorados
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    isMobile: window.innerWidth <= 768,
    isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
    isDesktop: window.innerWidth > 1024
  });
  
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setScreenSize({
        width,
        isMobile: width <= 768,
        isTablet: width > 768 && width <= 1024,
        isDesktop: width > 1024
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const esMobile = screenSize.isMobile;
  
  // Determinar modo de visualización
  const getModoVisualizacion = () => {
    if (modoVisualizacion === 'auto') {
      return esMobile ? 'list' : 'table'; // Lista compacta en móvil, tabla en desktop
    }
    return modoVisualizacion;
  };
  
  const modoActual = getModoVisualizacion();
  const mostrarTarjetas = modoActual === 'cards';
  const mostrarLista = modoActual === 'list';
  const mostrarTabla = modoActual === 'table';
  
  // Estados para edición inline
  const [editandoVale, setEditandoVale] = useState(null);
  const [valoresEditados, setValoresEditados] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  function getHoyLocal() {
    // Usar la fecha local del sistema directamente
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getFechaLocal(fecha) {
    // Convertir un objeto Date a formato YYYY-MM-DD en hora local
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const hoy = getHoyLocal();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);

  // --- FUNCION CORRECTA PARA MONTO PERCIBIDO ---
  function getMontoPercibido(vale) {
    if (vale.tipo === 'Ingreso' && vale.estado === 'aprobado') {
      // Determinar el porcentaje que le corresponde al profesional
      let porcentajeProfesional = 50; // Por defecto 50%
      
      if (vale.dividirPorDos) {
        if (typeof vale.dividirPorDos === 'string') {
          // Nuevo sistema con porcentajes específicos
          porcentajeProfesional = Number(vale.dividirPorDos);
        } else if (vale.dividirPorDos === true) {
          // Sistema anterior (booleano) - 50%
          porcentajeProfesional = 50;
        }
      }
      
      // Calcular el monto base según el porcentaje
      const base = (Number(vale.valor) * porcentajeProfesional) / 100;
      
      // Sumar la comisión extra (no se divide)
      return base + (Number(vale.comisionExtra) || 0);
    }
    return 0;
  }

  useEffect(() => {
    setLoading(true);
    let valesServicio = [];
    let valesGasto = [];
    let unsub1, unsub2;
    let isMounted = true;

    const updateVales = () => {
      if (isMounted) {
        const todos = [...valesServicio, ...valesGasto];
        setVales(todos);

        const usuariosUnicos = Array.from(
          new Set(todos.map(v => v.peluqueroUid || v.peluqueroEmail || 'Desconocido'))
        );
        setUsuarios(usuariosUnicos);
      }
    };

    // Query optimizado para vales de servicio con filtro de fecha
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 90); // Últimos 90 días
    
    const qServicio = query(
      collection(db, 'vales_servicio'),
      where('fecha', '>=', fechaLimite),
      orderBy('fecha', 'desc'),
      limit(500)
    );

    unsub1 = onSnapshot(qServicio, snap => {
      valesServicio = [];
      snap.forEach(doc => {
        const data = doc.data();
        valesServicio.push({
          ...data,
          tipo: 'Ingreso',
          id: doc.id,
          fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
        });
      });
      updateVales();
      setLoading(false);
    });

    // Query optimizado para vales de gasto con filtro de fecha
    const qGasto = query(
      collection(db, 'vales_gasto'),
      where('fecha', '>=', fechaLimite),
      orderBy('fecha', 'desc'),
      limit(500)
    );

    unsub2 = onSnapshot(qGasto, snap => {
      valesGasto = [];
      snap.forEach(doc => {
        const data = doc.data();
        valesGasto.push({
          ...data,
          tipo: 'Egreso',
          id: doc.id,
          fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
        });
      });
      updateVales();
      setLoading(false);
    });

    getDocs(collection(db, 'usuarios')).then(usuariosSnap => {
      const nombres = {};
      usuariosSnap.forEach(docu => {
        const data = docu.data();
        nombres[data.email] = data.nombre || '';
      });
      setNombresUsuarios(nombres);
    }).catch(() => setError('Error al cargar los datos'));

    return () => {
      isMounted = false;
      unsub1 && unsub1();
      unsub2 && unsub2();
    };
  }, []);

  const handleFiltro = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const handleEliminar = async (vale) => {
    if (window.confirm('¿Seguro que deseas eliminar este vale?')) {
      await deleteDoc(doc(db, vale.tipo === 'Ingreso' ? 'vales_servicio' : 'vales_gasto', vale.id));
      setVales(vales => vales.filter(v => v.id !== vale.id));
    }
  };

  // --- FUNCIONES PARA EDICIÓN INLINE ---
  const iniciarEdicion = (vale) => {
    setEditandoVale(vale.id);
    
    // Determinar el porcentaje actual
    let porcentajeActual = 50;
    if (vale.dividirPorDos) {
      if (typeof vale.dividirPorDos === 'string') {
        porcentajeActual = Number(vale.dividirPorDos);
      } else if (vale.dividirPorDos === true) {
        porcentajeActual = 50;
      }
    }
    
    // Cargar todos los valores existentes del vale
    setValoresEditados({
      codigo: vale.codigo || '',
      peluquero: vale.peluquero || '',
      fecha: vale.fecha ? vale.fecha.toISOString().split('T')[0] : '',
      tipo: vale.tipo || '',
      valor: vale.valor || '',
      servicio: vale.servicio || vale.concepto || '',
      concepto: vale.concepto || vale.servicio || '',
      observacion: vale.observacion || '',
      comisionExtra: vale.comisionExtra || '',
      dividirPorDos: porcentajeActual,
      local: vale.local || '',
      formaPago: vale.formaPago || '',
      estado: vale.estado || 'pendiente'
    });
  };

  const cancelarEdicion = () => {
    setEditandoVale(null);
    setValoresEditados({});
  };

  const handleCambioValor = (campo, valor) => {
    setValoresEditados(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Función para manejar paginación
  const getPaginatedData = (data) => {
    if (mostrarTabla) return data; // Las tablas no usan paginación
    
    const startIndex = (paginaActual - 1) * elementosPorPagina;
    const endIndex = startIndex + elementosPorPagina;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPaginas = (totalItems) => {
    if (mostrarTabla) return 1;
    return Math.ceil(totalItems / elementosPorPagina);
  };

  const guardarEdicion = async (vale) => {
    if (guardando) return;
    
    setGuardando(true);
    try {
      const coleccion = vale.tipo === 'Ingreso' ? 'vales_servicio' : 'vales_gasto';
      const valeRef = doc(db, coleccion, vale.id);
      
      // Preparar los datos a actualizar
      const datosActualizar = {
        valor: Number(valoresEditados.valor) || 0,
        observacion: valoresEditados.observacion || '',
        local: valoresEditados.local || '',
        formaPago: valoresEditados.formaPago || ''
      };

      // Agregar campos específicos según el tipo
      if (vale.tipo === 'Ingreso') {
        datosActualizar.servicio = valoresEditados.servicio || '';
        datosActualizar.comisionExtra = Number(valoresEditados.comisionExtra) || 0;
        datosActualizar.dividirPorDos = valoresEditados.dividirPorDos;
      } else {
        datosActualizar.concepto = valoresEditados.servicio || '';
      }

      await updateDoc(valeRef, datosActualizar);
      
      // Actualizar el estado local
      setVales(vales => vales.map(v => 
        v.id === vale.id ? { ...v, ...datosActualizar } : v
      ));
      
      setEditandoVale(null);
      setValoresEditados({});
      
      // Mostrar mensaje de éxito
      setMensaje('✅ Vale actualizado correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error('Error al guardar:', error);
      setMensaje('❌ Error al guardar los cambios');
      setTimeout(() => setMensaje(''), 5000);
    } finally {
      setGuardando(false);
    }
  };

  // --- EXPORTAR PDF ---
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // 1. Filtra los vales según los filtros actuales
    const valesFiltradosPDF = vales.filter(v => {
      if (filtros.usuario && (v.peluqueroUid !== filtros.usuario && v.peluqueroEmail !== filtros.usuario)) return false;
      if (filtros.tipo && v.tipo !== filtros.tipo) return false;
      if (filtros.estado && (v.estado || 'pendiente') !== filtros.estado) return false;
      if (filtros.local && (!v.local || v.local !== filtros.local)) return false;
      if (filtros.formaPago && v.formaPago !== filtros.formaPago) return false;
      const fechaValeLocal = new Date(v.fecha.getTime() - v.fecha.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      if (fechaValeLocal < desde) return false;
      if (fechaValeLocal > hasta) return false;
      return true;
    });

    // 2. Ordena los vales por usuario y fecha
    const valesOrdenados = valesFiltradosPDF.sort((a, b) => {
      const emailA = a.peluqueroEmail || 'Desconocido';
      const emailB = b.peluqueroEmail || 'Desconocido';
      if (emailA !== emailB) return emailA.localeCompare(emailB);
      return a.fecha - b.fecha;
    });

    // 3. Resumen general desde la perspectiva del local
    const ingresosLocal = valesFiltradosPDF
      .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + (Number(v.valor) || 0), 0);

    const montoPercibidoLocal = valesFiltradosPDF
      .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
      .reduce((a, v) => {
        const totalServicio = Number(v.valor) || 0;
        const montoProfesional = getMontoPercibido(v);
        return a + (totalServicio - montoProfesional);
      }, 0);

    const montoPercibidoProfesionales = valesFiltradosPDF
      .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + getMontoPercibido(v), 0);

    const solicitudesProfesionales = valesFiltradosPDF
      .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
      .reduce((a, v) => a + (Number(v.valor) || 0), 0);

    const gananciaNegocio = montoPercibidoLocal;

    const totalPendiente = valesFiltradosPDF
      .filter(v => v.estado === 'pendiente')
      .reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);

    let startY = 20;

    // ENCABEZADO PRINCIPAL - MÁS COMPACTO
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMEN GENERAL DE VALES', doc.internal.pageSize.getWidth() / 2, startY, { align: 'center' });
    startY += 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Período: ${desde} - ${hasta}`, doc.internal.pageSize.getWidth() / 2, startY, { align: 'center' });
    startY += 12;

    // RESUMEN GENERAL EN FORMATO TABLA COMPACTA - PERSPECTIVA DEL LOCAL
    const resumenData = [
      ['Total Facturado', 'Monto Local', 'Comisiones Prof.', 'Solicitudes Prof.', 'Ganancia Local', 'Pendiente'],
      [
        `$${ingresosLocal.toLocaleString()}`,
        `$${montoPercibidoLocal.toLocaleString()}`,
        `$${montoPercibidoProfesionales.toLocaleString()}`,
        `$${solicitudesProfesionales.toLocaleString()}`,
        `$${gananciaNegocio.toLocaleString()}`,
        `$${totalPendiente.toLocaleString()}`
      ]
    ];

    autoTable(doc, {
      head: [resumenData[0]],
      body: [resumenData[1]],
      startY: startY,
      styles: { 
        fontSize: 10,
        cellPadding: 4,
        halign: 'center',
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { fillColor: [220, 252, 231], textColor: [22, 163, 74] }, // Verde para total facturado
        1: { fillColor: [219, 234, 254], textColor: [37, 99, 235] }, // Azul para monto del local
        2: { fillColor: [254, 226, 226], textColor: [220, 53, 69] }, // Rojo para comisiones profesionales
        3: { fillColor: [255, 237, 213], textColor: [245, 158, 66] }, // Naranja para solicitudes
        4: { fillColor: gananciaNegocio >= 0 ? [220, 252, 231] : [254, 226, 226], textColor: gananciaNegocio >= 0 ? [22, 163, 74] : [220, 53, 69] }, // Verde/Rojo según ganancia
        5: { fillColor: [255, 237, 213], textColor: [245, 158, 66] } // Naranja para pendiente
      },
      theme: 'grid',
      margin: { left: 50, right: 50 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontSize: 9, fontStyle: 'bold' }
    });

    startY = doc.lastAutoTable.finalY + 15;

    // 4. TABLA ÚNICA CON TODOS LOS VALES
    const rows = [];
    
    valesOrdenados.forEach(v => {
      // Asegúrate de que v.fecha es un objeto Date
      const fecha = v.fecha instanceof Date ? v.fecha : new Date(v.fecha);
      rows.push([
        v.codigo || '-',
        fecha.toLocaleDateString(),
        fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        v.tipo,
        v.servicio || v.concepto || '-',
        v.formaPago ? v.formaPago.charAt(0).toUpperCase() + v.formaPago.slice(1) : '-',
        v.local || '-',
        Number(v.valor).toLocaleString(),
        getMontoPercibido(v).toLocaleString(),
                v.estado || 'pendiente',
        v.aprobadoPor || '-',
        v.observacion || '-',
        v.comisionExtra ? `+$${Number(v.comisionExtra).toLocaleString()}` : '-'
      ]);
    });

    // Dibuja la tabla única
    autoTable(doc, {
      head: [[
        'Código', 'Fecha', 'Hora', 'Tipo', 'Servicio/Concepto', 'F. Pago', 'Local',
        'Valor', 'M. Percibido', 'Estado', 'Aprobado por', 'Observación', 'Comisión'
      ]],
      body: rows,
      startY: startY,
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 18 }, // Código
        1: { cellWidth: 18 }, // Fecha
        2: { cellWidth: 12 }, // Hora
        3: { cellWidth: 15 }, // Tipo
        4: { cellWidth: 30 }, // Servicio/Concepto
        5: { cellWidth: 18 }, // Forma de Pago
        6: { cellWidth: 20 }, // Local
        7: { cellWidth: 18, halign: 'right' }, // Valor
        8: { cellWidth: 20, halign: 'right' }, // Monto Percibido
        9: { cellWidth: 18 }, // Estado
        10: { cellWidth: 25 }, // Aprobado por
        11: { cellWidth: 30 }, // Observación
        12: { cellWidth: 18, halign: 'right' } // Comisión
      },
      theme: 'striped',
      margin: { left: 14, right: 14 },
      headStyles: { 
        fillColor: [99, 102, 241], 
        textColor: 255, 
        fontSize: 8, 
        fontStyle: 'bold' 
      }
    });

    // 5. RESUMEN POR USUARIO AL FINAL
    const agrupadosPorUsuario = {};
    valesFiltradosPDF.forEach(v => {
      const email = v.peluqueroEmail || 'Desconocido';
      if (!agrupadosPorUsuario[email]) agrupadosPorUsuario[email] = [];
      agrupadosPorUsuario[email].push(v);
    });

    startY = doc.lastAutoTable.finalY + 15;

    if (startY + 30 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      startY = 20;
    }

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMEN POR USUARIO', doc.internal.pageSize.getWidth() / 2, startY, { align: 'center' });
    startY += 10;

    const resumenUsuarios = Object.keys(agrupadosPorUsuario).map(email => {
      const lista = agrupadosPorUsuario[email];
      const nombre = lista.find(v => v.peluqueroNombre)?.peluqueroNombre || nombresUsuarios[email] || email;
      
      const totalIngresosU = lista
        .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
        .reduce((a, v) => a + (Number(v.valor) || 0), 0);

      const totalEgresosU = lista
        .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
        .reduce((a, v) => a + (Number(v.valor) || 0), 0);

      const saldoU = totalIngresosU - totalEgresosU;

      const totalPercibidoU = lista
        .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
        .reduce((a, v) => a + getMontoPercibido(v), 0);

      return [
        nombre,
        `$${totalIngresosU.toLocaleString()}`,
        `$${totalEgresosU.toLocaleString()}`,
        `$${saldoU.toLocaleString()}`,
        `$${totalPercibidoU.toLocaleString()}`
      ];
    });

    autoTable(doc, {
      head: [['Usuario', 'Ingresos', 'Egresos', 'Saldo', 'Monto Percibido']],
      body: resumenUsuarios,
      startY: startY,
      styles: { 
        fontSize: 10,
        cellPadding: 3,
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' }
      },
      theme: 'grid',
      margin: { left: 60, right: 60 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' }
    });

    doc.save(`resumen_vales_${desde}_a_${hasta}.pdf`);
  };

  // --- FILTRADO Y RESUMENES PARA LA VISTA ---
  const valesFiltrados = vales.filter(v => {
    if (filtros.usuario && (v.peluqueroUid !== filtros.usuario && v.peluqueroEmail !== filtros.usuario)) return false;
    if (filtros.tipo && v.tipo !== filtros.tipo) return false;
    if (filtros.estado && (v.estado || 'pendiente') !== filtros.estado) return false;
    if (filtros.local) {
      if (!v.local || v.local !== filtros.local) return false;
    }
    if (filtros.formaPago && v.formaPago !== filtros.formaPago) return false;
    const fechaValeLocal = new Date(v.fecha.getTime() - v.fecha.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    if (fechaValeLocal < desde) return false;
    if (fechaValeLocal > hasta) return false;
    return true;
  });

  // CÁLCULOS DESDE LA PERSPECTIVA DEL LOCAL/NEGOCIO
  
  // 1. INGRESOS BRUTOS DEL LOCAL (total facturado a clientes - SIN incluir propinas)
  const ingresosLocal = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => {
      const montoServicio = Number(v.valor) || 0;
      // Las propinas (comisiones extra) no son facturación del local
      return a + montoServicio;
    }, 0);

  // 2. MONTO QUE PERCIBE EL LOCAL (ingresos - comisiones de porcentaje, SIN contar propinas)
  const montoPercibidoLocal = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => {
      const totalServicio = Number(v.valor) || 0;
      // Calcular solo la comisión por porcentaje (sin propinas)
      let porcentajeProfesional = 50; // Por defecto 50%
      
      if (v.dividirPorDos) {
        if (typeof v.dividirPorDos === 'string') {
          porcentajeProfesional = Number(v.dividirPorDos);
        } else if (v.dividirPorDos === true) {
          porcentajeProfesional = 50;
        }
      }
      
      const comisionPorcentaje = (totalServicio * porcentajeProfesional) / 100;
      const montoLocal = totalServicio - comisionPorcentaje;
      
      return a + montoLocal;
    }, 0);

  // 3. MONTO QUE PERCIBEN LOS PROFESIONALES (comisiones por servicios + propinas)
  const montoPercibidoProfesionales = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + getMontoPercibido(v), 0);

  // 3.1. PROPINAS TOTALES (comisiones extra que van 100% al profesional)

  // 4. SOLICITUDES DE DINERO DE PROFESIONALES (egresos = adelantos/préstamos)
  const solicitudesProfesionales = valesFiltrados
    .filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  // 5. GANANCIA NETA DEL LOCAL (lo que queda después de pagar comisiones, NO incluye solicitudes)
  const gananciaNegocio = montoPercibidoLocal;

  // 6. MARGEN REAL DEL LOCAL (porcentaje que efectivamente se queda el negocio)
  const margenReal = ingresosLocal > 0 ? (montoPercibidoLocal / ingresosLocal) * 100 : 0;

  // Totales incluyendo pendientes para mostrar más información
  const totalIngresosPendientes = valesFiltrados
    .filter(v => v.tipo === 'Ingreso' && v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  const totalSolicitudesPendientes = valesFiltrados
    .filter(v => v.tipo === 'Egreso' && v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0), 0);

  const totalPendiente = valesFiltrados
    .filter(v => v.estado === 'pendiente')
    .reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);

  const agrupados = {};
  valesFiltrados.forEach(vale => {
    // Usar UID del usuario como clave principal, con fallback al email
    const clave = vale.peluqueroUid || vale.peluqueroEmail || 'Desconocido';
    if (!agrupados[clave]) agrupados[clave] = [];
    agrupados[clave].push(vale);
  });

  if (loading) return <Spinner animation="border" className="d-block mx-auto mt-5" />;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <>
      {/* Estilos específicos para móvil */}
      <style>{`
        @media (max-width: 576px) {
          .cuadre-diario-container .table-responsive {
            font-size: 10px !important;
          }
          .cuadre-diario-container .table th,
          .cuadre-diario-container .table td {
            padding: 3px 2px !important;
            vertical-align: middle;
          }
          .cuadre-diario-container .badge {
            font-size: 7px !important;
            padding: 1px 3px !important;
          }
          .cuadre-diario-container .btn-sm {
            font-size: 12px !important;
            padding: 6px 8px !important;
            min-width: 36px !important;
            min-height: 32px !important;
          }
        }
        @media (max-width: 768px) {
          .cuadre-diario-container .table {
            font-size: 11px !important;
          }
        }
      `}</style>
      <div className="cuadre-diario-container">
      <Row className="justify-content-center mt-4">
        <Col xs={12} md={12} lg={12} xl={12} style={{paddingLeft: 8, paddingRight: 8, maxWidth: "100%"}}>
          <Card className="shadow-sm border-0" style={{ 
            borderRadius: 24, 
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
            <Card.Body className="p-4">
              {/* Header moderno */}
              <div className="text-center mb-4">
                <div style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  borderRadius: 20,
                  padding: '20px',
                  color: 'white',
                  marginBottom: 24
                }}>
                  <h2 style={{ 
                    fontWeight: 700, 
                    fontSize: 28, 
                    marginBottom: 8,
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    <i className="bi bi-table me-3" style={{ fontSize: 32 }}></i>
                    {desde === hasta ? 'Cuadre Diario' : 'Cuadre por Período'}
                  </h2>
                  <p style={{ 
                    fontSize: 16, 
                    marginBottom: 0, 
                    opacity: 0.9 
                  }}>
                    {desde === hasta 
                      ? `Análisis del ${desde === getHoyLocal() ? 'día de hoy' : desde}`
                      : `Período del ${desde} al ${hasta}`
                    }
                  </p>
                </div>
              </div>
              {/* Filtros modernos */}
              <Card className="mb-4 border-0" style={{ 
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderRadius: 20 
              }}>
                <Card.Body className="p-4">
                  <div className="d-flex align-items-center mb-3">
                    <i className="bi bi-funnel me-2" style={{ fontSize: 20, color: '#6366f1' }}></i>
                    <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>Filtros</h5>
                  </div>
                  <Form>
                    <Row className="g-3 justify-content-center">
                      <Col xs={12} sm={6} md={3}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-person me-1"></i>Usuario
                          </Form.Label>
                          <Form.Select 
                            name="usuario" 
                            value={filtros.usuario} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todos</option>
                            {usuarios.map(u => {
                              // Intentar obtener el nombre desde los vales existentes
                              const valeConNombre = vales.find(v => 
                                (v.peluqueroUid === u || v.peluqueroEmail === u) && v.peluquero
                              );
                              const displayName = valeConNombre?.peluquero || nombresUsuarios[u] || u;
                              
                              // Solo mostrar usuarios que tengan nombre real (no códigos Firebase)
                              if (displayName === u && (u.includes('@') || u.length > 20)) {
                                return null; // No mostrar códigos Firebase
                              }
                              
                              return (
                                <option key={u} value={u}>
                                  {displayName}
                                </option>
                              );
                            }).filter(Boolean)}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-arrow-up-down me-1"></i>Tipo
                          </Form.Label>
                          <Form.Select 
                            name="tipo" 
                            value={filtros.tipo || ''} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todos</option>
                            <option value="Ingreso">Ingreso</option>
                            <option value="Egreso">Egreso</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-check-circle me-1"></i>Estado
                          </Form.Label>
                          <Form.Select 
                            name="estado" 
                            value={filtros.estado || ''} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todos</option>
                            <option value="aprobado">Aprobado</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="rechazado">Rechazado</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-geo-alt me-1"></i>Local
                          </Form.Label>
                          <Form.Select 
                            name="local" 
                            value={filtros.local || ''} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todos</option>
                            <option value="La Tirana">La Tirana</option>
                            <option value="Salvador Allende">Salvador Allende</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-credit-card me-1"></i>Forma de Pago
                          </Form.Label>
                          <Form.Select 
                            name="formaPago" 
                            value={filtros.formaPago || ''} 
                            onChange={handleFiltro}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="">Todas</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="debito">Débito</option>
                            <option value="transferencia">Transferencia</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6} md={2}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-sort-down me-1"></i>Orden
                          </Form.Label>
                          <Form.Select 
                            value={ordenDireccion} 
                            onChange={e => setOrdenDireccion(e.target.value)}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          >
                            <option value="desc">Más recientes primero</option>
                            <option value="asc">Más antiguos primero</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col xs={6} sm={3} md={1}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-calendar me-1"></i>Desde
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={desde}
                            max={hasta}
                            onChange={e => setDesde(e.target.value)}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6} sm={3} md={1}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                            <i className="bi bi-calendar-range me-1"></i>Hasta
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={hasta}
                            min={desde}
                            onChange={e => setHasta(e.target.value)}
                            style={{ 
                              borderRadius: 12,
                              border: '2px solid #e2e8f0',
                              fontSize: 14
                            }}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    
                    {/* Botones de rangos predefinidos */}
                    <Row className="mt-3">
                      <Col>
                        <div className="d-flex flex-wrap gap-2 justify-content-center">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const hoy = getHoyLocal();
                              setDesde(hoy);
                              setHasta(hoy);
                            }}
                            style={{ borderRadius: 12, fontSize: 12 }}
                          >
                            <i className="bi bi-calendar-day me-1"></i>Hoy
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const hoy = new Date();
                              const inicioSemana = new Date(hoy);
                              inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo
                              const finSemana = new Date(inicioSemana);
                              finSemana.setDate(inicioSemana.getDate() + 6); // Sábado
                              
                              setDesde(getFechaLocal(inicioSemana));
                              setHasta(getFechaLocal(finSemana));
                            }}
                            style={{ borderRadius: 12, fontSize: 12 }}
                          >
                            <i className="bi bi-calendar-week me-1"></i>Esta semana
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const hoy = new Date();
                              const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                              const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
                              
                              setDesde(getFechaLocal(inicioMes));
                              setHasta(getFechaLocal(finMes));
                            }}
                            style={{ borderRadius: 12, fontSize: 12 }}
                          >
                            <i className="bi bi-calendar-month me-1"></i>Este mes
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const hoy = new Date();
                              const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                              const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                              
                              setDesde(getFechaLocal(inicioMesAnterior));
                              setHasta(getFechaLocal(finMesAnterior));
                            }}
                            style={{ borderRadius: 12, fontSize: 12 }}
                          >
                            <i className="bi bi-calendar-minus me-1"></i>Mes anterior
                          </Button>
                        </div>
                      </Col>
                    </Row>
                  </Form>
                  {filtros.usuario && (
                    <div style={{ 
                      textAlign: 'center', 
                      marginTop: 16,
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)',
                      borderRadius: 16,
                      border: '2px solid rgba(139, 92, 246, 0.2)'
                    }}>
                      <i className="bi bi-person-check me-2" style={{ color: '#7c3aed' }}></i>
                      <strong style={{ color: '#5b21b6' }}>Usuario seleccionado:</strong> 
                      <span style={{ fontWeight: 600, marginLeft: 8, color: '#6d28d9' }}>
                        {(() => {
                          const valeConNombre = vales.find(v => 
                            (v.peluqueroUid === filtros.usuario || v.peluqueroEmail === filtros.usuario) && v.peluquero
                          );
                          const displayName = valeConNombre?.peluquero || nombresUsuarios[filtros.usuario] || filtros.usuario;
                          return displayName !== filtros.usuario ? `${displayName} (${filtros.usuario})` : filtros.usuario;
                        })()}
                      </span>
                    </div>
                  )}
                </Card.Body>
              </Card>
              {/* Resumen financiero moderno */}
              <Row className="mb-4">
                <Col>
                  <Card className="border-0 shadow-sm" style={{ 
                    borderRadius: 20,
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
                  }}>
                    <Card.Body className="p-4">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center">
                          <i className="bi bi-building me-2" style={{ fontSize: 20, color: '#0891b2' }}></i>
                          <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>
                            Resumen Financiero del Local
                          </h5>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: '#64748b',
                            background: 'rgba(8, 145, 178, 0.1)',
                            padding: '2px 8px',
                            borderRadius: 8,
                            marginLeft: 8
                          }}>
                            Perspectiva del Negocio
                          </span>
                        </div>
                        <small style={{ 
                          color: '#64748b', 
                          fontWeight: 500,
                          fontSize: 12,
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.5)',
                          borderRadius: 8
                        }}>
                          <i className="bi bi-calendar-range me-1"></i>
                          {desde === hasta 
                            ? (desde === getHoyLocal() ? 'Hoy' : desde)
                            : `${desde} - ${hasta}`
                          }
                        </small>
                      </div>
                      <div className="row g-3">
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(34, 197, 94, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 8 }}>
                              <i className="bi bi-cash-stack me-1"></i>Total Facturado
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#166534' }}>
                              ${ingresosLocal.toLocaleString()}
                            </div>
                            {totalIngresosPendientes > 0 && (
                              <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>
                                + ${totalIngresosPendientes.toLocaleString()} pendientes
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(59, 130, 246, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 8 }}>
                              <i className="bi bi-building me-1"></i>Monto para el Local
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8' }}>
                              ${montoPercibidoLocal.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4 }}>
                              {margenReal.toFixed(1)}% del total facturado
                            </div>
                          </div>
                        </div>
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(239, 68, 68, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>
                              <i className="bi bi-person-dash me-1"></i>Comisiones Profesionales
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#991b1b' }}>
                              ${montoPercibidoProfesionales.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                              {ingresosLocal > 0 ? ((montoPercibidoProfesionales / ingresosLocal) * 100).toFixed(1) : 0}% del total facturado
                            </div>
                          </div>
                        </div>
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(251, 146, 60, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#ea580c', marginBottom: 8 }}>
                              <i className="bi bi-wallet me-1"></i>Solicitudes Profesionales
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#c2410c' }}>
                              ${solicitudesProfesionales.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 11, color: '#ea580c', marginTop: 4 }}>
                              Adelantos y préstamos solicitados
                            </div>
                            {totalSolicitudesPendientes > 0 && (
                              <div style={{ fontSize: 11, color: '#ea580c', marginTop: 4 }}>
                                + ${totalSolicitudesPendientes.toLocaleString()} pendientes
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-6 col-md text-center">
                          <div style={{ 
                            background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: '2px solid rgba(245, 158, 11, 0.2)'
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#d97706', marginBottom: 8 }}>
                              <i className="bi bi-clock me-1"></i>Pendiente Total
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#92400e' }}>
                              ${totalPendiente.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="col-12 col-md text-center">
                          <div style={{ 
                            background: gananciaNegocio >= 0 ? 
                              'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 
                              'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                            borderRadius: 16,
                            padding: 16,
                            border: `2px solid ${gananciaNegocio >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                          }}>
                            <div style={{ 
                              fontSize: 13, 
                              fontWeight: 600, 
                              color: gananciaNegocio >= 0 ? '#15803d' : '#dc2626', 
                              marginBottom: 8 
                            }}>
                              <i className={`bi ${gananciaNegocio >= 0 ? 'bi-trophy' : 'bi-exclamation-triangle'} me-1`}></i>
                              Ganancia del Local
                            </div>
                            <div style={{ 
                              fontSize: 20, 
                              fontWeight: 700, 
                              color: gananciaNegocio >= 0 ? '#166534' : '#991b1b'
                            }}>
                              ${gananciaNegocio.toLocaleString()}
                            </div>
                            <div style={{ 
                              fontSize: 11, 
                              color: gananciaNegocio >= 0 ? '#15803d' : '#dc2626', 
                              marginTop: 4 
                            }}>
                              <small>
                                💡 Solo incluye facturación por servicios (propinas van directo al profesional)
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Panel informativo sobre la lógica financiera */}
              <Row className="mb-4">
                <Col>
                  <Card className="border-0" style={{ 
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    borderRadius: 16,
                    border: '1px solid rgba(148, 163, 184, 0.2)'
                  }}>
                    <Card.Body className="p-3">
                      <div className="d-flex align-items-start">
                        <i className="bi bi-info-circle me-2 mt-1" style={{ fontSize: 16, color: '#6366f1' }}></i>
                        <div style={{ fontSize: 13, lineHeight: 1.4, color: '#475569' }}>
                          <strong style={{ color: '#1e293b' }}>Explicación del resumen financiero:</strong>
                          <br />
                          • <strong>Total Facturado:</strong> Dinero cobrado por servicios (SIN incluir propinas extras)
                          <br />
                          • <strong>Monto para el Local:</strong> Porción del local después de descontar comisiones por porcentaje
                          <br />
                          • <strong>Comisiones Profesionales:</strong> Comisiones por porcentaje + propinas extras (traspaso directo cliente → profesional)
                          <br />
                          • <strong>Solicitudes Profesionales:</strong> Adelantos, préstamos o retiros solicitados por los profesionales (NO afecta la ganancia del local)
                          <br />
                          • <strong>Ganancia del Local:</strong> Utilidad real del negocio (solo del monto facturado por servicios)
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Selector de vista moderno */}
              <Card className="mb-4 border-0" style={{ 
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                borderRadius: 20 
              }}>
                <Card.Body className="p-4 text-center">
                  <div className="d-flex align-items-center justify-content-center mb-3">
                    <i className="bi bi-layout-three-columns me-2" style={{ fontSize: 20, color: '#6366f1' }}></i>
                    <h6 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>Modo de Vista</h6>
                  </div>
                  <div className="d-flex justify-content-center align-items-center flex-wrap gap-3">
                    <ToggleButtonGroup type="radio" name="vista" value={vista} onChange={setVista}>
                      <ToggleButton 
                        id="vista-cards" 
                        value="cards" 
                        variant="outline-primary" 
                        size="sm"
                        style={{ 
                          borderRadius: 12,
                          fontWeight: 600,
                          padding: '8px 16px'
                        }}
                      >
                        <i className="bi bi-person-badge me-1"></i>Por Profesional
                      </ToggleButton>
                      <ToggleButton 
                        id="vista-tabla" 
                        value="tabla" 
                        variant="outline-primary" 
                        size="sm"
                        style={{ 
                          borderRadius: 12,
                          fontWeight: 600,
                          padding: '8px 16px'
                        }}
                      >
                        <i className="bi bi-table me-1"></i>Vista General
                      </ToggleButton>
                    </ToggleButtonGroup>
                    
                    {/* Selector de modo de visualización */}
                    <ToggleButtonGroup type="radio" name="modoVisualizacion" value={modoVisualizacion} onChange={(value) => { setModoVisualizacion(value); setPaginaActual(1); }}>
                      <ToggleButton 
                        id="modo-auto" 
                        value="auto" 
                        variant="outline-info"
                        style={{ 
                          borderRadius: '12px 0 0 0',
                          fontWeight: 600,
                          fontSize: '11px',
                          padding: '6px 10px'
                        }}
                      >
                        <i className="bi bi-phone me-1"></i>Auto
                      </ToggleButton>
                      <ToggleButton 
                        id="modo-table" 
                        value="table" 
                        variant="outline-info"
                        style={{ 
                          borderRadius: '0',
                          fontWeight: 600,
                          fontSize: '11px',
                          padding: '6px 10px'
                        }}
                      >
                        <i className="bi bi-table me-1"></i>Tabla
                      </ToggleButton>
                      <ToggleButton 
                        id="modo-list" 
                        value="list" 
                        variant="outline-info"
                        style={{ 
                          borderRadius: '0',
                          fontWeight: 600,
                          fontSize: '11px',
                          padding: '6px 10px'
                        }}
                      >
                        <i className="bi bi-list-ul me-1"></i>Lista
                        {valesFiltrados.length > 25 && (
                          <span style={{ 
                            fontSize: '7px', 
                            background: '#22c55e', 
                            color: 'white', 
                            borderRadius: 2, 
                            padding: '1px 3px', 
                            marginLeft: 2 
                          }}>
                            REC
                          </span>
                        )}
                      </ToggleButton>
                      <ToggleButton 
                        id="modo-cards" 
                        value="cards" 
                        variant="outline-info"
                        style={{ 
                          borderRadius: '0 0 12px 12px',
                          fontWeight: 600,
                          fontSize: '11px',
                          padding: '6px 10px'
                        }}
                      >
                        <i className="bi bi-card-list me-1"></i>Tarjetas
                      </ToggleButton>
                    </ToggleButtonGroup>
                    
                    <Button 
                      variant="success" 
                      size="sm" 
                      onClick={handleExportPDF}
                      style={{ 
                        borderRadius: 12,
                        fontWeight: 600,
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none'
                      }}
                    >
                      <i className="bi bi-file-earmark-arrow-down me-1"></i>Descargar PDF
                    </Button>
                  </div>
                </Card.Body>
              </Card>

              {/* Vista general (tabla global) modernizada */}
              {vista === 'tabla' ? (
                valesFiltrados.length === 0 ? (
                  <Card className="border-0" style={{ 
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    borderRadius: 20 
                  }}>
                    <Card.Body className="text-center p-5">
                      <i className="bi bi-inbox" style={{ fontSize: 48, color: '#d97706', marginBottom: 16 }}></i>
                      <h5 style={{ color: '#92400e', fontWeight: 600 }}>No hay vales para mostrar</h5>
                      <p style={{ color: '#a16207', marginBottom: 0 }}>Ajusta los filtros para ver más resultados</p>
                    </Card.Body>
                  </Card>
                ) : (
                  <Card className="border-0 shadow-sm" style={{ 
                    borderRadius: 20,
                    background: 'white',
                    border: '2px solid #e2e8f0'
                  }}>
                    <Card.Body className="p-0">
                      {/* Header de Vista General mejorado */}
                      <div style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        borderRadius: '20px 20px 0 0',
                        padding: 20,
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {/* Decoración de fondo */}
                        <div style={{
                          position: 'absolute',
                          top: -20,
                          right: -20,
                          width: 100,
                          height: 100,
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '50%'
                        }}></div>
                        
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <div>
                            <h4 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                              <i className="bi bi-table me-2" style={{ fontSize: 24 }}></i>
                              Vista General
                            </h4>
                            <div style={{ fontSize: 14, opacity: 0.8 }}>
                              {valesFiltrados.length} transacciones en el período
                              {!mostrarTabla && valesFiltrados.length > 15 && (
                                <span style={{ 
                                  marginLeft: 8, 
                                  padding: '2px 6px', 
                                  background: 'rgba(255,255,255,0.2)', 
                                  borderRadius: 4, 
                                  fontSize: 11 
                                }}>
                                  📄 Paginado
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ 
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderRadius: 16,
                            padding: '12px 16px',
                            textAlign: 'center',
                            backdropFilter: 'blur(10px)'
                          }}>
                            <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 2 }}>REGISTROS</div>
                            <div style={{ 
                              fontSize: 20, 
                              fontWeight: 800,
                              color: '#4ade80'
                            }}>
                              {valesFiltrados.length}
                            </div>
                          </div>
                        </div>

                        {mensaje && (
                          <div style={{
                            background: mensaje.includes('✅') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            borderRadius: 12,
                            padding: 12,
                            fontSize: 13,
                            fontWeight: 500,
                            color: mensaje.includes('✅') ? '#4ade80' : '#f87171',
                            border: `1px solid ${mensaje.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            {mensaje}
                          </div>
                        )}
                      </div>
                      
                      {/* Información de edición mejorada */}
                      {(rol === 'admin' || rol === 'anfitrion') && (
                        <div style={{ 
                          padding: '16px 20px',
                          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <div style={{ 
                            fontSize: 13, 
                            color: '#475569',
                            lineHeight: 1.4
                          }}>
                            <div className="d-flex align-items-center mb-2">
                              <i className="bi bi-info-circle me-2" style={{color: '#3b82f6'}}></i>
                              <strong style={{ color: '#1e293b' }}>Panel de Edición:</strong>
                              <span className="ms-2">
                                Haz clic en <i className="bi bi-pencil mx-1" style={{color: '#3b82f6'}}></i> para editar un vale.
                              </span>
                            </div>
                            <div className="d-flex align-items-center flex-wrap gap-3">
                              <span>
                                <strong>Rol actual:</strong> 
                                <span style={{
                                  color: '#dc3545', 
                                  fontWeight: 600,
                                  background: 'rgba(220, 53, 69, 0.1)',
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  marginLeft: 4
                                }}>
                                  {rol || 'Sin rol'}
                                </span>
                              </span>
                              <span>
                                <strong>Estados:</strong> 
                                <span style={{color: '#22c55e', marginLeft: 6}}>■ Aprobado</span>
                                <span style={{color: '#dc3545', marginLeft: 6}}>■ Rechazado</span>
                                <span style={{color: '#f59e42', marginLeft: 6}}>■ Pendiente</span>
                                <span style={{color: '#6366f1', marginLeft: 6}}>■ Editando</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Contenido según modo de visualización */}
                      <div style={{
                        background: "#fff", 
                        borderRadius: '0 0 20px 20px',
                        padding: (mostrarTarjetas || mostrarLista) ? '16px' : '8px',
                        position: 'relative'
                      }}>
                        {mostrarLista ? (
                          // Vista de lista compacta (ideal para alto volumen)
                          <div>
                            {(() => {
                              const valesOrdenados = valesFiltrados.sort((a, b) => b.fecha - a.fecha);
                              const valesPaginados = getPaginatedData(valesOrdenados);
                              
                              return (
                                <>
                                  {valesPaginados.map(vale => (
                                    <ListaCompactaVale
                                      key={vale.id}
                                      vale={vale}
                                      editandoVale={editandoVale}
                                      valoresEditados={valoresEditados}
                                      handleCambioValor={handleCambioValor}
                                      nombresUsuarios={nombresUsuarios}
                                      guardarEdicion={guardarEdicion}
                                      cancelarEdicion={cancelarEdicion}
                                      setEditandoVale={setEditandoVale}
                                      handleEliminar={handleEliminar}
                                      rol={rol}
                                    />
                                  ))}
                                  
                                  <PaginacionComponente
                                    paginaActual={paginaActual}
                                    totalPaginas={getTotalPaginas(valesOrdenados.length)}
                                    totalItems={valesOrdenados.length}
                                    onCambioPagina={setPaginaActual}
                                    elementosPorPagina={elementosPorPagina}
                                  />
                                </>
                              );
                            })()}
                          </div>
                        ) : mostrarTarjetas ? (
                          // Vista de tarjetas completas (para casos específicos)
                          <div>
                            {(() => {
                              const valesOrdenados = valesFiltrados.sort((a, b) => b.fecha - a.fecha);
                              const valesPaginados = getPaginatedData(valesOrdenados);
                              
                              return (
                                <>
                                  {valesPaginados.map(vale => (
                                    screenSize.isMobile ? (
                                      <TarjetaVale
                                        key={vale.id}
                                        vale={vale}
                                        editandoVale={editandoVale}
                                        valoresEditados={valoresEditados}
                                        handleCambioValor={handleCambioValor}
                                        nombresUsuarios={nombresUsuarios}
                                        guardarEdicion={guardarEdicion}
                                        cancelarEdicion={cancelarEdicion}
                                        setEditandoVale={setEditandoVale}
                                        handleEliminar={handleEliminar}
                                        rol={rol}
                                      />
                                    ) : (
                                      <TarjetaValeDesktop
                                        key={vale.id}
                                        vale={vale}
                                        editandoVale={editandoVale}
                                        valoresEditados={valoresEditados}
                                        handleCambioValor={handleCambioValor}
                                        nombresUsuarios={nombresUsuarios}
                                        guardarEdicion={guardarEdicion}
                                        cancelarEdicion={cancelarEdicion}
                                        setEditandoVale={setEditandoVale}
                                        handleEliminar={handleEliminar}
                                        rol={rol}
                                        screenSize={screenSize}
                                      />
                                    )
                                  ))}
                                  
                                  <PaginacionComponente
                                    paginaActual={paginaActual}
                                    totalPaginas={getTotalPaginas(valesOrdenados.length)}
                                    totalItems={valesOrdenados.length}
                                    onCambioPagina={setPaginaActual}
                                    elementosPorPagina={elementosPorPagina}
                                  />
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          // Vista de tabla tradicional
                          <div style={{
                            overflowX: 'auto',
                            width: '100%'
                          }}>
                            {/* Indicador de scroll en móvil */}
                            <div className="d-md-none" style={{
                              position: 'absolute',
                              top: '12px',
                              right: '16px',
                              background: 'rgba(99, 102, 241, 0.9)',
                              color: 'white',
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              zIndex: 10,
                              fontWeight: 600
                            }}>
                              ← Desliza →
                            </div>
                    <Table
                      striped
                      hover
                      size="sm"
                      className="mb-0"
                      style={{
                        fontSize: '12px',
                        minWidth: '800px', // Forzar ancho mínimo para scroll horizontal
                        background: "#fff",
                        borderRadius: 8,
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <thead style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        color: 'white'
                      }}>
    <tr>
      {/* Código - Siempre visible con scroll */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '60px'}}>Código</th>
      
      {/* Profesional - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', minWidth: '100px'}}>        Profesional
      </th>
      
      {/* Fecha - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '70px'}}>Fecha</th>
      
      {/* Hora - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '50px'}}>Hora</th>
      
      {/* Tipo - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '60px'}}>Tipo</th>
      
      {/* Servicio/Concepto - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', minWidth: '120px'}}>
        Servicio
      </th>
      
      {/* Forma de Pago - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '60px'}}>Pago</th>
      
      {/* Local - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '60px'}}>Local</th>
      
      {/* Monto - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '80px'}}>Monto</th>
      
      {/* % Prof. - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '50px'}}>%</th>
      
      {/* Monto Percibido - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '80px'}}>Percibido</th>
      
      {/* Estado - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '70px'}}>Estado</th>
      
      {/* Aprobado por - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '80px'}}>Aprobado</th>
      
      {/* Observación - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '100px'}}>Observación</th>
      
      {/* Comisión Extra - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '70px'}}>Comisión</th>
      
      {/* Acciones - Siempre visible */}
      <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '90px'}}>
        Acciones
      </th>
    </tr>
  </thead>
                      <tbody>
                        {valesFiltrados
                          .sort((a, b) => {
                            let valA, valB;
                            switch (ordenColumna) {
                              case 'codigo':
                                valA = a.codigo || '';
                                valB = b.codigo || '';
                                break;
                              case 'fecha':
                                valA = a.fecha;
                                valB = b.fecha;
                                break;
                              case 'hora':
                                valA = a.fecha.getHours() * 60 + a.fecha.getMinutes();
                                valB = b.fecha.getHours() * 60 + b.fecha.getMinutes();
                                break;
                              case 'tipo':
                                valA = a.tipo;
                                valB = b.tipo;
                                break;
                              case 'valor':
                                valA = Number(a.valor) || 0;
                                valB = Number(b.valor) || 0;
                                break;
                              default:
                                valA = a[ordenColumna] || '';
                                valB = b[ordenColumna] || '';
                            }
                            if (valA < valB) return ordenDireccion === 'asc' ? -1 : 1;
                            if (valA > valB) return ordenDireccion === 'asc' ? 1 : -1;
                            return 0;
                          })
                          .map(vale => (
                            <tr
                              key={vale.id}
                              style={{
                                borderLeft: `6px solid ${
                                  editandoVale === vale.id 
                                    ? '#6366f1' // Azul para modo edición
                                    : vale.estado === 'aprobado'
                                    ? '#22c55e'
                                    : vale.estado === 'rechazado'
                                    ? '#dc3545'
                                    : '#f59e42'
                                }`,
                                background: editandoVale === vale.id 
                                  ? '#f1f5f9' // Fondo azul claro para modo edición
                                  : vale.estado === 'rechazado'
                                  ? '#fef2f2'
                                  : vale.estado === 'aprobado'
                                  ? '#f0fdf4'
                                  : '#fffbeb',
                                fontWeight: 500,
                                fontSize: 15,
                                boxShadow: editandoVale === vale.id ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <td style={{padding: '4px 2px', fontWeight: 700, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', background: '#f8fafc', fontSize: '10px'}}>
                                {vale.codigo || '-'}
                              </td>
                              <td style={{padding: '4px 2px', fontWeight: 600, color: '#2563eb', fontSize: '10px', maxWidth: '100px'}}>
                                <div style={{ 
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  lineHeight: '1.2'
                                }}>
                                  {vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || 'Desconocido'}
                                </div>
                              </td>
                              <td style={{padding: '4px 2px', fontSize: '10px'}}>{vale.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</td>
                              <td style={{padding: '4px 2px', fontSize: '10px'}}>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td style={{padding: '4px 2px'}}>
                                <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`} style={{fontSize: '8px', padding: '2px 4px'}}>
                                  {vale.tipo === 'Ingreso' ? 'ING' : 'EGR'}
                                </span>
                              </td>
                              <td style={{padding: '4px 2px', fontWeight: 600, color: '#374151', fontSize: '10px', maxWidth: '120px'}}>
                                <div style={{ 
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  lineHeight: '1.2'
                                }}>
                                  <CeldaEditableExterna
                                    esEditable={editandoVale === vale.id}
                                    valorActual={valoresEditados.servicio !== undefined ? valoresEditados.servicio : (vale.servicio || vale.concepto || '')}
                                    onCambio={valor => handleCambioValor('servicio', valor)}
                                  />
                                </div>
                                {/* En móvil, mostrar % y comisión extra editables */}
                                <div className="d-sm-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {vale.tipo === 'Ingreso' && (
                                    <>
                                      {/* Porcentaje editable en móvil */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <span>%:</span>
                                        <CeldaEditableExterna
                                          esEditable={editandoVale === vale.id}
                                          valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (() => {
                                            if (vale.dividirPorDos) {
                                              if (typeof vale.dividirPorDos === 'string') {
                                                return vale.dividirPorDos;
                                              } else {
                                                return '50';
                                              }
                                            } else {
                                              return '100';
                                            }
                                          })()}
                                          onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                                          opciones={[
                                            {value: '100', label: '100%'},
                                            {value: '50', label: '50%'},
                                            {value: '45', label: '45%'},
                                            {value: '40', label: '40%'}
                                          ]}
                                        />
                                      </div>
                                      {/* Comisión extra */}
                                      {(vale.comisionExtra > 0 || editandoVale === vale.id) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                          <span style={{ color: '#6366f1', fontWeight: 600 }}>+$</span>
                                          <CeldaEditableExterna
                                            esEditable={editandoVale === vale.id}
                                            valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (vale.comisionExtra || 0)}
                                            onCambio={valor => handleCambioValor('comisionExtra', Number(valor) || 0)}
                                            tipo="number"
                                          />
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td  style={{padding: '4px 2px', fontSize: '10px'}}>
                                <CeldaEditableExterna
                                  esEditable={editandoVale === vale.id}
                                  valorActual={valoresEditados.formaPago !== undefined ? valoresEditados.formaPago : (vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '')}
                                  onCambio={valor => handleCambioValor('formaPago', valor)}
                                  opciones={[
                                    {value: 'efectivo', label: 'Efectivo'},
                                    {value: 'debito', label: 'Débito'},
                                    {value: 'transferencia', label: 'Transferencia'}
                                  ]}
                                />
                              </td>
                              <td  style={{padding: '4px 2px', fontSize: '10px'}}>
                                <CeldaEditableExterna
                                  esEditable={editandoVale === vale.id}
                                  valorActual={valoresEditados.local !== undefined ? valoresEditados.local : (vale.local || '-')}
                                  onCambio={valor => handleCambioValor('local', valor)}
                                  opciones={[
                                    {value: 'La Tirana', label: 'La Tirana'},
                                    {value: 'Salvador Allende', label: 'Salvador Allende'}
                                  ]}
                                />
                              </td>
                              <td style={{
                                padding: '4px 2px',
                                color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545',
                                fontWeight: 700,
                                fontSize: '10px',
                                textAlign: 'right'
                              }}>
                                {editandoVale === vale.id ? (
                                  <div className="d-flex align-items-center justify-content-end" style={{ gap: '2px' }}>
                                    <span style={{fontSize: '9px'}}>{vale.tipo === 'Ingreso' ? '+' : '-'}$</span>
                                    <CeldaEditableExterna
                                      esEditable={true}
                                      valorActual={valoresEditados.valor !== undefined ? valoresEditados.valor : (vale.valor || 0)}
                                      onCambio={valor => handleCambioValor('valor', valor)}
                                      tipo="number"
                                    />
                                  </div>
                                ) : (
                                  <div style={{ whiteSpace: 'nowrap' }}>
                                    {`${vale.tipo === 'Ingreso' ? '+' : '-'}$${Number(vale.valor || 0).toLocaleString()}`}
                                  </div>
                                )}
                                {/* En móvil, mostrar monto percibido debajo */}
                                <div className="d-md-none" style={{ fontSize: '10px', color: '#6366f1', marginTop: '2px', fontWeight: 600 }}>
                                  {vale.tipo === 'Ingreso' && vale.estado === 'aprobado' && (
                                    <>Percibido: ${getMontoPercibido(vale).toLocaleString()}</>
                                  )}
                                </div>
                              </td>
                              <td  style={{padding: '6px', color: '#7c3aed', fontWeight: 600, textAlign: 'center', fontSize: '11px'}}>
                                {vale.tipo === 'Ingreso' ? (
                                  editandoVale === vale.id ? (
                                    <div className="d-flex align-items-center justify-content-center">
                                      <CeldaEditableExterna
                                        esEditable={true}
                                        valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (vale.dividirPorDos || 50)}
                                        onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                                        opciones={[
                                          {value: '100', label: '100%'},
                                          {value: '50', label: '50%'},
                                          {value: '45', label: '45%'},
                                          {value: '40', label: '40%'}
                                        ]}
                                      />
                                    </div>
                                  ) : (
                                    (() => {
                                      if (vale.dividirPorDos) {
                                        if (typeof vale.dividirPorDos === 'string') {
                                          return `${vale.dividirPorDos}%`;
                                        } else {
                                          return '50%';
                                        }
                                      } else {
                                        return '100%';
                                      }
                                    })()
                                  )
                                ) : '-'}
                              </td>
                              <td  style={{padding: '6px', color: '#6366f1', fontWeight: 700, fontSize: '11px'}}>
                                {vale.tipo === 'Ingreso' && vale.estado === 'aprobado'
                                  ? `$${getMontoPercibido(vale).toLocaleString()}`
                                  : '-'}
                              </td>
                              <td style={{padding: '4px 2px'}}>
                                <span className={`badge ${
                                  vale.estado === 'aprobado'
                                    ? 'bg-success'
                                    : vale.estado === 'rechazado'
                                    ? 'bg-danger'
                                    : 'bg-warning text-dark'
                                }`} style={{fontSize: '9px'}}>
                                  {vale.estado === 'aprobado'
                                  ? 'OK'
                                  : vale.estado === 'rechazado'
                                  ? 'X'
                                  : 'P'}
                                </span>
                                {/* En móvil, mostrar observación debajo del estado */}
                                <div className="d-lg-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {vale.observacion && vale.observacion !== '-' && vale.observacion}
                                </div>
                              </td>
                              <td  style={{padding: '4px 2px', fontSize: '10px'}}>
                                {vale.estado === 'aprobado' && vale.aprobadoPor ? (
                                  <span style={{ color: '#22c55e', fontWeight: 700 }}>
                                    <i className="bi bi-check-circle" style={{marginRight: 4}}></i>
                                    {vale.aprobadoPor}
                                  </span>
                                ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
                                  <span style={{ color: '#dc3545', fontWeight: 700 }}>
                                    <i className="bi bi-x-circle" style={{marginRight: 4}}></i>
                                    {vale.aprobadoPor}
                                  </span>
                                ) : (
                                  <span className="text-secondary">-</span>
                                )}
                              </td>
                              <td  style={{padding: '4px 2px', fontSize: '10px'}}>
                                <CeldaEditableExterna
                                  esEditable={editandoVale === vale.id}
                                  valorActual={valoresEditados.observacion !== undefined ? valoresEditados.observacion : (vale.observacion || '-')}
                                  onCambio={valor => handleCambioValor('observacion', valor)}
                                />
                              </td>
                              <td  style={{padding: '6px', color: '#6366f1', fontWeight: 700, fontSize: '11px'}}>
                                {vale.tipo === 'Ingreso' ? (
                                  editandoVale === vale.id ? (
                                    <div className="d-flex align-items-center">
                                      <span style={{marginRight: 4, fontSize: '10px'}}>+$</span>
                                      <CeldaEditableExterna
                                        esEditable={true}
                                        valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (vale.comisionExtra || 0)}
                                        onCambio={valor => handleCambioValor('comisionExtra', valor)}
                                        tipo="number"
                                      />
                                    </div>
                                  ) : (
                                    vale.comisionExtra ? `+$${Number(vale.comisionExtra).toLocaleString()}` : '-'
                                  )
                                ) : '-'}
                              </td>
                              <td style={{padding: '4px 2px', minWidth: '90px'}}>
                                  <div className="d-flex gap-1 flex-wrap justify-content-center">
                                    {editandoVale === vale.id ? (
                                      <>
                                        <Button
                                          variant="success"
                                          size="sm"
                                          onClick={() => guardarEdicion(vale)}
                                          disabled={guardando}
                                          title="Guardar cambios"
                                          style={{
                                            borderRadius: 6, 
                                            padding: '6px 8px',
                                            minWidth: '36px',
                                            minHeight: '32px'
                                          }}
                                        >
                                          {guardando ? (
                                            <Spinner as="span" animation="border" size="sm" />
                                          ) : (
                                            <i className="bi bi-check" style={{fontSize: '14px'}}></i>
                                          )}
                                        </Button>
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={cancelarEdicion}
                                          disabled={guardando}
                                          title="Cancelar"
                                          style={{
                                            borderRadius: 6, 
                                            padding: '6px 8px',
                                            minWidth: '36px',
                                            minHeight: '32px'
                                          }}
                                        >
                                          <i className="bi bi-x" style={{fontSize: '14px'}}></i>
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          onClick={() => iniciarEdicion(vale)}
                                          title="Editar"
                                          style={{
                                            borderRadius: 6, 
                                            padding: '6px 8px',
                                            minWidth: '36px',
                                            minHeight: '32px'
                                          }}
                                        >
                                          <i className="bi bi-pencil" style={{fontSize: '14px'}}></i>
                                        </Button>
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          onClick={() => handleEliminar(vale)}
                                          title="Eliminar"
                                          style={{
                                            borderRadius: 6, 
                                            padding: '6px 8px',
                                            minWidth: '36px',
                                            minHeight: '32px'
                                          }}
                                        >
                                          <i className="bi bi-trash" style={{fontSize: '14px'}}></i>
                                        </Button>
                                      </>
                                    )}
                                  </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                )
              ) : (
                // Vista por profesional: una tabla por profesional
                <Row>
                  {Object.entries(agrupados).map(([clave, lista]) => {
                    // Obtener el nombre del primer vale de la lista
                    const nombre = lista[0]?.peluquero || nombresUsuarios[lista[0]?.peluqueroEmail] || lista[0]?.peluqueroEmail || clave;
                    const ingresos = lista.filter(v => v.tipo === 'Ingreso' && v.estado === 'aprobado').reduce((a, v) => a + (Number(v.valor) || 0), 0);
                    const egresos = lista.filter(v => v.tipo === 'Egreso' && v.estado === 'aprobado').reduce((a, v) => a + (Number(v.valor) || 0), 0);
                    const saldo = ingresos - egresos;
                    const pendiente = lista.filter(v => v.estado === 'pendiente').reduce((a, v) => a + (Number(v.valor) || 0) * (v.tipo === 'Ingreso' ? 1 : -1), 0);
                    const percibido = lista.filter(v => v.estado === 'aprobado').reduce((a, v) => {
                      if (v.tipo === 'Ingreso') return a + getMontoPercibido(v);
                      if (v.tipo === 'Egreso') return a - (Number(v.valor) || 0);
                      return a;
                    }, 0);

                    return (
                      <Col xs={12} key={clave} className="mb-4">
                        <Card className="shadow-sm border-0" style={{ 
                          borderRadius: 20,
                          background: 'white',
                          border: '2px solid #e2e8f0'
                        }}>
                          <Card.Body className="p-0">
                            {/* Header del profesional mejorado */}
                            <div style={{
                              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                              borderRadius: '20px 20px 0 0',
                              padding: 20,
                              color: 'white',
                              position: 'relative',
                              overflow: 'hidden'
                            }}>
                              {/* Decoración de fondo */}
                              <div style={{
                                position: 'absolute',
                                top: -20,
                                right: -20,
                                width: 100,
                                height: 100,
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '50%'
                              }}></div>
                              
                              <div className="d-flex align-items-center justify-content-between mb-3">
                                <div>
                                  <h4 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                                    <i className="bi bi-person-badge me-2" style={{ fontSize: 24 }}></i>
                                    {nombre}
                                  </h4>
                                  <div style={{ fontSize: 14, opacity: 0.8 }}>
                                    {lista.length} transacciones en el período
                                  </div>
                                </div>
                                <div style={{ 
                                  background: 'rgba(255, 255, 255, 0.15)',
                                  borderRadius: 16,
                                  padding: '12px 16px',
                                  textAlign: 'center',
                                  backdropFilter: 'blur(10px)'
                                }}>
                                  <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 2 }}>SALDO NETO</div>
                                  <div style={{ 
                                    fontSize: 20, 
                                    fontWeight: 800,
                                    color: saldo >= 0 ? '#4ade80' : '#f87171'
                                  }}>
                                    ${saldo.toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              {/* Métricas mejoradas */}
                              <div className="row g-3">
                                <div className="col-6 col-md-3">
                                  <div style={{ 
                                    background: 'rgba(34, 197, 94, 0.2)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(34, 197, 94, 0.3)'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      marginBottom: 4 
                                    }}>
                                      <i className="bi bi-arrow-up-circle me-1" style={{ color: '#4ade80', fontSize: 14 }}></i>
                                      <span style={{ fontSize: 11, opacity: 0.9 }}>INGRESOS</span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80' }}>
                                      ${ingresos.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="col-6 col-md-3">
                                  <div style={{ 
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      marginBottom: 4 
                                    }}>
                                      <i className="bi bi-arrow-down-circle me-1" style={{ color: '#f87171', fontSize: 14 }}></i>
                                      <span style={{ fontSize: 11, opacity: 0.9 }}>EGRESOS</span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>
                                      ${egresos.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="col-6 col-md-3">
                                  <div style={{ 
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(245, 158, 11, 0.3)'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      marginBottom: 4 
                                    }}>
                                      <i className="bi bi-clock-history me-1" style={{ color: '#fbbf24', fontSize: 14 }}></i>
                                      <span style={{ fontSize: 11, opacity: 0.9 }}>PENDIENTE</span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>
                                      ${pendiente.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="col-6 col-md-3">
                                  <div style={{ 
                                    background: 'rgba(147, 51, 234, 0.2)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(147, 51, 234, 0.3)'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      marginBottom: 4 
                                    }}>
                                      <i className="bi bi-wallet2 me-1" style={{ color: '#a855f7', fontSize: 14 }}></i>
                                      <span style={{ fontSize: 11, opacity: 0.9 }}>PERCIBIDO</span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#a855f7' }}>
                                      ${percibido.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Tabla de registros mejorada */}
                            <div className="p-4">
                              <div className="d-flex align-items-center justify-content-between mb-3">
                                <h6 style={{ 
                                  margin: 0, 
                                  fontWeight: 600, 
                                  color: '#1e293b',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  <i className="bi bi-list-ul me-2" style={{ fontSize: 16, color: '#6366f1' }}></i>
                                  Detalle de Transacciones
                                </h6>
                                <span style={{ 
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: '#64748b',
                                  padding: '4px 12px',
                                  background: '#f8fafc',
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0'
                                }}>
                                  {lista.length} registros
                                </span>
                              </div>
                              {mostrarLista ? (
                                // Vista de lista compacta (ideal para alto volumen)
                                <div style={{ padding: '8px' }}>
                                  {(() => {
                                    const valesOrdenados = lista.sort((a, b) => b.fecha - a.fecha);
                                    const valesPaginados = getPaginatedData(valesOrdenados);
                                    
                                    return (
                                      <>
                                        {valesPaginados.map(vale => (
                                          <ListaCompactaVale
                                            key={vale.id}
                                            vale={vale}
                                            editandoVale={editandoVale}
                                            valoresEditados={valoresEditados}
                                            handleCambioValor={handleCambioValor}
                                            nombresUsuarios={nombresUsuarios}
                                            guardarEdicion={guardarEdicion}
                                            cancelarEdicion={cancelarEdicion}
                                            setEditandoVale={setEditandoVale}
                                            handleEliminar={handleEliminar}
                                            rol={rol}
                                          />
                                        ))}
                                        
                                        <PaginacionComponente
                                          paginaActual={paginaActual}
                                          totalPaginas={getTotalPaginas(valesOrdenados.length)}
                                          totalItems={valesOrdenados.length}
                                          onCambioPagina={setPaginaActual}
                                          elementosPorPagina={elementosPorPagina}
                                        />
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : mostrarTarjetas ? (
                                // Vista de tarjetas completas (para casos específicos)
                                <div style={{ padding: '8px' }}>
                                  {(() => {
                                    const valesOrdenados = lista.sort((a, b) => b.fecha - a.fecha);
                                    const valesPaginados = getPaginatedData(valesOrdenados);
                                    
                                    return (
                                      <>
                                        {valesPaginados.map(vale => (
                                          screenSize.isMobile ? (
                                            <TarjetaVale
                                              key={vale.id}
                                              vale={vale}
                                              editandoVale={editandoVale}
                                              valoresEditados={valoresEditados}
                                              handleCambioValor={handleCambioValor}
                                              nombresUsuarios={nombresUsuarios}
                                              guardarEdicion={guardarEdicion}
                                              cancelarEdicion={cancelarEdicion}
                                              setEditandoVale={setEditandoVale}
                                              handleEliminar={handleEliminar}
                                              rol={rol}
                                            />
                                          ) : (
                                            <TarjetaValeDesktop
                                              key={vale.id}
                                              vale={vale}
                                              editandoVale={editandoVale}
                                              valoresEditados={valoresEditados}
                                              handleCambioValor={handleCambioValor}
                                              nombresUsuarios={nombresUsuarios}
                                              guardarEdicion={guardarEdicion}
                                              cancelarEdicion={cancelarEdicion}
                                              setEditandoVale={setEditandoVale}
                                              handleEliminar={handleEliminar}
                                              rol={rol}
                                              screenSize={screenSize}
                                            />
                                          )
                                        ))}
                                        
                                        <PaginacionComponente
                                          paginaActual={paginaActual}
                                          totalPaginas={getTotalPaginas(valesOrdenados.length)}
                                          totalItems={valesOrdenados.length}
                                          onCambioPagina={setPaginaActual}
                                          elementosPorPagina={elementosPorPagina}
                                        />
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : (
                                // Vista de tabla tradicional
                                <div style={{
                                  overflowX: 'auto',
                                  width: '100%',
                                  background: '#f8fafc',
                                  borderRadius: 12,
                                  border: '1px solid #e2e8f0',
                                  padding: '8px'
                                }}>
                              <Table
                                striped
                                hover
                                size="sm"
                                className="mb-0"
                                style={{
                                  fontSize: '12px',
                                  minWidth: '800px', // Forzar ancho mínimo para scroll horizontal
                                  background: "#fff",
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                <thead style={{
                                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                                  color: 'white'
                                }}>
  <tr>
    {/* Código - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '60px'}}>Código</th>
    
    {/* Profesional - Oculto en vista profesional ya que está en el header */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', minWidth: '80px'}}>Profesional</th>
    
    {/* Fecha - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '70px'}}>Fecha</th>
    
    {/* Hora - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '50px'}}>Hora</th>
    
    {/* Tipo - Siempre visible */}
    <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '70px'}}>Tipo</th>
    
    {/* Servicio/Concepto - Más compacto */}
    <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', minWidth: '100px'}}>
      <span className="d-none d-md-inline">Servicio</span>
      <span className="d-md-none">Serv.</span>
    </th>
    
    {/* Forma de Pago - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '60px'}}>Pago</th>
    
    {/* Local - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '60px'}}>Local</th>
    
    {/* Monto - Siempre visible */}
    <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '80px'}}>Monto</th>
    
    {/* % Prof. - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '50px'}}>%</th>
    
    {/* Monto Percibido - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '70px'}}>Percibido</th>
    
    {/* Estado - Siempre visible */}
    <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '70px'}}>Estado</th>
    
    {/* Aprobado por - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '80px'}}>Aprobado</th>
    
    {/* Observación - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '100px'}}>Observación</th>
    
    {/* Comisión Extra - Oculto en móvil */}
    <th  style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '70px'}}>Comisión</th>
    
    {/* Acciones - Siempre visible */}
    <th style={{padding: '6px 4px', fontWeight: 600, fontSize: 10, borderBottom: 'none', width: '80px'}}>
      <span className="d-none d-sm-inline">Acciones</span>
      <span className="d-sm-none">Act.</span>
    </th>
  </tr>
</thead>
                                <tbody>
                                  {lista
    .sort((a, b) => b.fecha - a.fecha)
    .map(vale => (
      <tr
        key={vale.id}
        style={{
          borderLeft: `6px solid ${
            editandoVale === vale.id 
              ? '#6366f1' // Azul para modo edición
              : vale.estado === 'aprobado'
              ? '#22c55e'
              : vale.estado === 'rechazado'
              ? '#dc3545'
              : '#f59e42'
          }`,
          background: editandoVale === vale.id 
            ? '#f1f5f9' // Fondo azul claro para modo edición
            : vale.estado === 'rechazado'
            ? '#fef2f2'
            : vale.estado === 'aprobado'
            ? '#f0fdf4'
            : '#fffbeb',
          fontWeight: 500,
          fontSize: 15,
          boxShadow: editandoVale === vale.id ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <td  style={{padding: '4px 2px', fontWeight: 700, color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545', background: '#f8fafc', fontSize: '10px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.codigo !== undefined ? valoresEditados.codigo : (vale.codigo || '-')}
            onCambio={valor => handleCambioValor('codigo', valor)}
            tipo="text"
          />
        </td>
        <td  style={{padding: '4px 2px', fontWeight: 600, color: '#2563eb', fontSize: '10px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.peluquero !== undefined ? valoresEditados.peluquero : (vale.peluquero || nombresUsuarios[vale.peluqueroEmail] || vale.peluqueroEmail || 'Desconocido')}
            onCambio={valor => handleCambioValor('peluquero', valor)}
            tipo="text"
          />
        </td>
        <td  style={{padding: '4px 2px', fontSize: '10px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.fecha !== undefined ? valoresEditados.fecha : vale.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
            onCambio={valor => handleCambioValor('fecha', valor)}
            tipo="date"
          />
        </td>
        <td  style={{padding: '4px 2px', fontSize: '10px'}}>{vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td style={{padding: '4px 2px'}}>
          {editandoVale === vale.id ? (
            <CeldaEditableExterna
              esEditable={true}
              valorActual={valoresEditados.tipo !== undefined ? valoresEditados.tipo : vale.tipo}
              onCambio={valor => handleCambioValor('tipo', valor)}
              opciones={[
                {value: 'Ingreso', label: 'Ingreso'},
                {value: 'Egreso', label: 'Egreso'}
              ]}
            />
          ) : (
            <span className={`badge ${vale.tipo === 'Ingreso' ? 'bg-success' : 'bg-danger'}`} style={{fontSize: '8px', padding: '2px 4px'}}>
              {vale.tipo === 'Ingreso' ? 'ING' : 'EGR'}
            </span>
          )}
          {/* En móvil, mostrar información adicional */}
          <div className="d-sm-none" style={{ fontSize: '9px', color: '#64748b', marginTop: '1px', lineHeight: '1.1' }}>
            {vale.fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {vale.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </td>
        <td style={{padding: '4px 2px', fontWeight: 600, color: '#374151', fontSize: '10px', maxWidth: '120px'}}>
          <div style={{ 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            lineHeight: '1.2'
          }}>
            <CeldaEditableExterna
              esEditable={editandoVale === vale.id}
              valorActual={valoresEditados.servicio !== undefined ? valoresEditados.servicio : (vale.servicio || vale.concepto || '-')}
              onCambio={valor => handleCambioValor('servicio', valor)}
              tipo="text"
            />
          </div>
          {/* En móvil, mostrar información adicional */}
          <div className="d-lg-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            {vale.formaPago && `${vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1)}`}
            {vale.local && ` • ${vale.local}`}
          </div>
          <div className="d-sm-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {vale.tipo === 'Ingreso' && (
              <>
                {/* Porcentaje editable en móvil */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span>%:</span>
                  <CeldaEditableExterna
                    esEditable={editandoVale === vale.id}
                    valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (() => {
                      if (vale.dividirPorDos) {
                        if (typeof vale.dividirPorDos === 'string') {
                          return vale.dividirPorDos;
                        } else {
                          return '50';
                        }
                      } else {
                        return '100';
                      }
                    })()}
                    onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                    opciones={[
                      {value: '100', label: '100%'},
                      {value: '50', label: '50%'},
                      {value: '45', label: '45%'},
                      {value: '40', label: '40%'}
                    ]}
                  />
                </div>
                {/* Comisión extra */}
                {(vale.comisionExtra > 0 || editandoVale === vale.id) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{ color: '#6366f1', fontWeight: 600 }}>+$</span>
                    <CeldaEditableExterna
                      esEditable={editandoVale === vale.id}
                      valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (vale.comisionExtra || 0)}
                      onCambio={valor => handleCambioValor('comisionExtra', Number(valor) || 0)}
                      tipo="number"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </td>
        <td  style={{padding: '4px 2px', fontSize: '10px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.formaPago !== undefined ? valoresEditados.formaPago : (vale.formaPago ? vale.formaPago.charAt(0).toUpperCase() + vale.formaPago.slice(1) : '-')}
            onCambio={valor => handleCambioValor('formaPago', valor)}
            opciones={[
              {value: 'efectivo', label: 'Efectivo'},
              {value: 'debito', label: 'Débito'},
              {value: 'transferencia', label: 'Transferencia'}
            ]}
          />
        </td>
        <td  style={{padding: '4px 2px', fontSize: '10px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.local !== undefined ? valoresEditados.local : (vale.local || '-')}
            onCambio={valor => handleCambioValor('local', valor)}
            opciones={[
              {value: 'La Tirana', label: 'La Tirana'},
              {value: 'Salvador Allende', label: 'Salvador Allende'}
            ]}
          />
        </td>
        <td style={{
          padding: '6px',
          color: vale.tipo === 'Ingreso' ? '#22c55e' : '#dc3545',
          fontWeight: 700,
          fontSize: '12px'
        }}>
          {editandoVale === vale.id ? (
            <div className="d-flex align-items-center">
              <span style={{marginRight: 4, fontSize: '10px'}}>{vale.tipo === 'Ingreso' ? '+' : '-'}$</span>
              <CeldaEditableExterna
                esEditable={true}
                valorActual={valoresEditados.valor !== undefined ? valoresEditados.valor : (vale.valor || 0)}
                onCambio={valor => handleCambioValor('valor', valor)}
                tipo="number"
              />
            </div>
          ) : (
            `${vale.tipo === 'Ingreso' ? '+' : '-'}$${Number(vale.valor || 0).toLocaleString()}`
          )}
          {/* En móvil, mostrar monto percibido */}
          <div className="d-md-none" style={{ fontSize: '10px', color: '#6366f1', marginTop: '2px', fontWeight: 600 }}>
            {vale.tipo === 'Ingreso' && vale.estado === 'aprobado' && (
              <>Percibido: ${getMontoPercibido(vale).toLocaleString()}</>
            )}
          </div>
        </td>
        <td  style={{padding: '6px', color: '#7c3aed', fontWeight: 600, textAlign: 'center', fontSize: '11px'}}>
          {vale.tipo === 'Ingreso' ? (
            editandoVale === vale.id ? (
              <div className="d-flex align-items-center justify-content-center">
                <CeldaEditableExterna
                  esEditable={true}
                  valorActual={valoresEditados.dividirPorDos !== undefined ? valoresEditados.dividirPorDos : (vale.dividirPorDos || 50)}
                  onCambio={valor => handleCambioValor('dividirPorDos', valor)}
                  opciones={[
                    {value: '100', label: '100%'},
                    {value: '50', label: '50%'},
                    {value: '45', label: '45%'},
                    {value: '40', label: '40%'}
                  ]}
                />
              </div>
            ) : (
              (() => {
                let porcentaje = 50;
                if (vale.dividirPorDos) {
                  if (typeof vale.dividirPorDos === 'string') {
                    porcentaje = Number(vale.dividirPorDos);
                  } else if (vale.dividirPorDos === true) {
                    porcentaje = 50;
                  }
                }
                return `${porcentaje}%`;
              })()
            )
          ) : '-'}
        </td>
        <td  style={{padding: '6px', color: '#6366f1', fontWeight: 700, fontSize: '11px'}}>
          {vale.tipo === 'Ingreso' && vale.estado === 'aprobado'
            ? `$${getMontoPercibido(vale).toLocaleString()}`
            : '-'}
        </td>
        <td style={{padding: '4px 2px'}}>
          {editandoVale === vale.id ? (
            <CeldaEditableExterna
              esEditable={true}
              valorActual={valoresEditados.estado !== undefined ? valoresEditados.estado : vale.estado}
              onCambio={valor => handleCambioValor('estado', valor)}
              opciones={[
                {value: 'pendiente', label: 'Pendiente'},
                {value: 'aprobado', label: 'Aprobado'},
                {value: 'rechazado', label: 'Rechazado'}
              ]}
            />
          ) : (
            <span className={`badge ${
              vale.estado === 'aprobado'
                ? 'bg-success'
                : vale.estado === 'rechazado'
                ? 'bg-danger'
                : 'bg-warning text-dark'
            }`} style={{fontSize: '9px'}}>
              {vale.estado === 'aprobado'
              ? 'OK'
              : vale.estado === 'rechazado'
              ? 'X'
              : 'P'}
            </span>
          )}
          {/* En móvil, mostrar observación */}
          <div className="d-lg-none" style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vale.observacion && vale.observacion !== '-' && vale.observacion}
          </div>
        </td>
        <td  style={{padding: '4px 2px', fontSize: '10px'}}>
          {vale.estado === 'aprobado' && vale.aprobadoPor ? (
            <span style={{ color: '#22c55e', fontWeight: 700 }}>
              <i className="bi bi-check-circle" style={{marginRight: 4}}></i>
              {vale.aprobadoPor}
            </span>
          ) : vale.estado === 'rechazado' && vale.aprobadoPor ? (
            <span style={{ color: '#dc3545', fontWeight: 700 }}>
              <i className="bi bi-x-circle" style={{marginRight: 4}}></i>
              {vale.aprobadoPor}
            </span>
          ) : (
            <span className="text-secondary">-</span>
          )}
        </td>
        <td  style={{padding: '4px 2px', fontSize: '10px'}}>
          <CeldaEditableExterna
            esEditable={editandoVale === vale.id}
            valorActual={valoresEditados.observacion !== undefined ? valoresEditados.observacion : (vale.observacion || '-')}
            onCambio={valor => handleCambioValor('observacion', valor)}
            tipo="text"
          />
        </td>
        <td  style={{padding: '6px', color: '#6366f1', fontWeight: 700, fontSize: '11px'}}>
          {vale.tipo === 'Ingreso' ? (
            editandoVale === vale.id ? (
              <div className="d-flex align-items-center">
                <span style={{marginRight: 4, fontSize: '10px'}}>+$</span>
                <CeldaEditableExterna
                  esEditable={true}
                  valorActual={valoresEditados.comisionExtra !== undefined ? valoresEditados.comisionExtra : (vale.comisionExtra || 0)}
                  onCambio={valor => handleCambioValor('comisionExtra', valor)}
                  tipo="number"
                />
              </div>
            ) : (
              vale.comisionExtra ? `+$${Number(vale.comisionExtra).toLocaleString()}` : '-'
            )
          ) : '-'}
        </td>
        <td style={{padding: '4px 2px', minWidth: '90px'}}>
          <div className="d-flex gap-1 flex-wrap justify-content-center">
            {editandoVale === vale.id ? (
              <>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => guardarEdicion(vale)}
                  disabled={guardando}
                  title="Guardar cambios"
                  style={{
                    borderRadius: 6, 
                    padding: '6px 8px',
                    minWidth: '36px',
                    minHeight: '32px'
                  }}
                >
                  {guardando ? (
                    <Spinner as="span" animation="border" size="sm" />
                  ) : (
                    <i className="bi bi-check" style={{fontSize: '14px'}}></i>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={cancelarEdicion}
                  disabled={guardando}
                  title="Cancelar"
                  style={{
                    borderRadius: 6, 
                    padding: '6px 8px',
                    minWidth: '36px',
                    minHeight: '32px'
                  }}
                >
                  <i className="bi bi-x" style={{fontSize: '14px'}}></i>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => iniciarEdicion(vale)}
                  title="Editar"
                  style={{
                    borderRadius: 6, 
                    padding: '6px 8px',
                    minWidth: '36px',
                    minHeight: '32px'
                  }}
                >
                  <i className="bi bi-pencil" style={{fontSize: '14px'}}></i>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleEliminar(vale)}
                  title="Eliminar"
                  style={{
                    borderRadius: 6, 
                    padding: '6px 8px',
                    minWidth: '36px',
                    minHeight: '32px'
                  }}
                >
                  <i className="bi bi-trash" style={{fontSize: '14px'}}></i>
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
    ))}
                                </tbody>
                              </Table>
                                </div>
                              )}
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      </div>
    </>
  );
}

export default CuadreDiario;