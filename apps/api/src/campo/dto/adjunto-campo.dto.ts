export interface AdjuntoCampoDto {
  id: number;
  nombreOriginal: string;
  mimeType: string;
  tamanioBytes: number;
  creadoAt: Date;
}

export interface ArchivoAdjuntoCampoDto extends AdjuntoCampoDto {
  rutaArchivo: string;
}
