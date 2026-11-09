/** Datos de SAP de la empresa del usuario. */
export interface CredencialesSap {
  esquema: string;
  usuario: string;
  contrasenia: string;
}

/** Lo que usa Comercia de la orden que devuelve SAP. */
export interface OrdenSapCreada {
  DocEntry?: number;
  DocNum?: number;
}

export interface SesionSap {
  sessionId: string;
}
