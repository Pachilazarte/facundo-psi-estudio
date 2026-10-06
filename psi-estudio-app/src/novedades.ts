// Versión de la app y lo que cambió en cada una. Al sacar una versión nueva: subir VERSION_APP,
// la versión de app.json, y agregar una entrada arriba de NOVEDADES.

import { File, Paths } from 'expo-file-system';

export const VERSION_APP = '1.1.0';

export const NOVEDADES = [
  {
    version: '1.1.0',
    fecha: '06/10/2026',
    cambios: [
      'La app se ve igual que la web: colores crema y verde.',
      'Las pestañas están abajo, para usar la app con una mano.',
      'Los mensajes son simples: si algo falla, te decimos qué hacer.',
      'Nueva pestaña Ajustes, con la versión y estas novedades.',
    ],
  },
];

const archivoVista = () => new File(Paths.document, 'novedades-vistas.txt');

/** Versión que la persona ya vio. Queda en el teléfono, en un archivo chico. */
export async function versionVista(): Promise<string | null> {
  try {
    const archivo = archivoVista();
    if (!archivo.exists) return null;
    return (await archivo.text()).trim() || null;
  } catch (e) {
    console.warn('[PsiEstudio] no se pudo leer la versión vista', e);
    return null;
  }
}

export function marcarVersionVista(version: string): void {
  try {
    const archivo = archivoVista();
    archivo.create({ overwrite: true });
    archivo.write(version);
  } catch (e) {
    console.warn('[PsiEstudio] no se pudo guardar la versión vista', e);
  }
}
