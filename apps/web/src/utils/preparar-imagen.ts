const MAX_ORIGEN_BYTES = 60 * 1024 * 1024;
const MAX_ENVIO_BYTES = 5 * 1024 * 1024;

/** Reduce fotos grandes antes de construir el multipart enviado a la API. */
export async function prepararImagen(archivo: File): Promise<File> {
  if (archivo.size > MAX_ORIGEN_BYTES) {
    throw new Error("La foto original supera 60 MB. Elegí una imagen más pequeña.");
  }
  if (archivo.type && !archivo.type.startsWith("image/")) {
    throw new Error("Seleccioná una imagen de la cámara o la galería.");
  }

  const url = URL.createObjectURL(archivo);
  let bitmap: ImageBitmap | null = null;
  try {
    let origen: CanvasImageSource;
    let ancho: number;
    let alto: number;
    if (archivo.size > 2 * 1024 * 1024 && typeof createImageBitmap === "function") {
      // Chrome/Android puede decodificar directamente a una resolución menor.
      try {
        bitmap = await createImageBitmap(archivo, { resizeWidth: 1920, resizeQuality: "high" });
        origen = bitmap;
        ancho = bitmap.width;
        alto = bitmap.height;
      } catch {
        if (archivo.size > 20 * 1024 * 1024) {
          throw new Error("No se pudo reducir esta foto grande en este dispositivo. Probá exportarla como JPG.");
        }
        const imagen = new Image();
        imagen.src = url;
        await imagen.decode();
        origen = imagen;
        ancho = imagen.naturalWidth;
        alto = imagen.naturalHeight;
      }
    } else {
      const imagen = new Image();
      imagen.src = url;
      await imagen.decode();
      origen = imagen;
      ancho = imagen.naturalWidth;
      alto = imagen.naturalHeight;
    }
    if (!ancho || !alto) {
      throw new Error("No se pudo leer la imagen.");
    }

    const canvas = document.createElement("canvas");
    const ladoMayor = Math.max(ancho, alto);
    const escala = Math.min(1, 1920 / ladoMayor);
    canvas.width = Math.max(1, Math.round(ancho * escala));
    canvas.height = Math.max(1, Math.round(alto * escala));
    const contexto = canvas.getContext("2d", { alpha: false });
    if (!contexto) throw new Error("No se pudo procesar la imagen.");
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(origen, 0, 0, canvas.width, canvas.height);
    bitmap?.close();
    bitmap = null;

    const exportar = (calidad: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen.")), "image/jpeg", calidad);
    });
    let resultado = await exportar(0.8);
    if (resultado.size > MAX_ENVIO_BYTES) resultado = await exportar(0.65);
    if (resultado.size > MAX_ENVIO_BYTES) {
      throw new Error("La foto sigue superando 5 MB después de comprimirla.");
    }
    const nombre = archivo.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([resultado], `${nombre}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch (error) {
    if (error instanceof Error && /^(La foto|Seleccioná|No se pudo)/.test(error.message)) throw error;
    throw new Error("No se pudo abrir esta imagen. Probá con una foto JPG de la galería.");
  } finally {
    bitmap?.close();
    URL.revokeObjectURL(url);
  }
}
