"use client";
import { useState } from 'react';
import { Modal } from './modal';
import './marcaciones.css';

export default function InfoColumna({ titulo, texto }: { titulo: string; texto: string }) {
  const [abierta, setAbierta] = useState(false);
  return <><button type="button" className="senales-info" aria-label={`Información sobre ${titulo}`} title={texto}
    onClick={() => setAbierta(true)}><span aria-hidden="true">i</span></button>
    <Modal titulo={titulo} abierto={abierta} onCerrar={() => setAbierta(false)}><p className="senales-explicacion">{texto}</p>
      <div className="mt-4 flex justify-end"><button type="button" className="min-h-11 rounded-lg border border-control-line px-4 text-sm hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-focus" onClick={() => setAbierta(false)}>Cancelar</button></div></Modal></>;
}
