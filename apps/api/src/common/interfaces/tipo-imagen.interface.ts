/** Tipo real de una imagen subida, detectado por su firma. */
export interface TipoImagen {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: '.jpg' | '.png' | '.webp';
}
