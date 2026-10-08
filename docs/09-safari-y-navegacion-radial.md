# Versión 2.37.0 — Arreglos de Safari, Clases y menú radial

Pedido de Facundo en un solo mensaje (zoom en los modales, panel de Clases roto, botones
flotando en Safari, número de clase opcional, desgrabación en Clases, menú "Más" como
navegación semicircular, visor de PDF "hoja doble" raro, notas largas del profesor,
biblioteca de PDFs con filtro). Todo en código, publicado y verificado donde se pudo.

## Causa raíz de los problemas de Safari

Dos cosas distintas que se mezclaban cuando "la pantalla hacía zoom sola" y "quedaba un
hueco con los botones flotando":

1. **Zoom automático al tocar un campo.** Safari en iPhone agranda la página sola cuando
   el campo de texto tocado tiene una letra más chica de 16px. Se ve como si el sistema
   "permitiera hacer zoom". Arreglo: `index.css` fuerza `font-size: 16px` en todo
   `input/select/textarea` en pantallas chicas, sin importar la clase de Tailwind que
   traiga encima.
2. **`100vh` no sigue el tamaño real de la ventana en Safari.** La barra de arriba/abajo
   de Safari aparece y desaparece sola; un modal medido con `92vh` en el momento
   equivocado deja un hueco de fondo vacío debajo, con los botones "flotando". Arreglo:
   todos los `vh` de modales y pantallas completas pasan a `dvh` (alto de ventana real),
   y los modales que antes eran una caja centrada pasan a hoja completa en el celular
   (`items-end`, `rounded-t-3xl`, pie de página pegado abajo con
   `env(safe-area-inset-bottom)`).

Se aplicó a `ModalClase`, `ModalExamenWithLinking`, `ModalApunteSplitView`,
`ModalSubirDocumentoPDF` y `ModalPDFViewer` (este último, además, pantalla completa de
verdad en el celular: sin bordes ni esquinas).

## ModalClase (Protocolo de Clase)

- **N° Clase ahora es opcional.** Sin número, se guarda `0` (no `null`): así no hace
  falta tocar el esquema de la base ni los saneadores de sincronización. Los lugares que
  mostraban "Clase #0" ahora muestran solo "Clase" cuando no hay número.
- **Nueva sección Desgrabación**, con textarea para pegar texto, botón "Pegar del
  Portapapeles" (con su propio manejo de error si Safari no da permiso) y subida de
  archivo `.txt`. Usa la columna `desgrabacion_md` que ya existía en `clases` (la llenaba
  antes solo la grabadora; faltaba la forma manual).
- El pie del modal (Cancelar / Guardar) quedó fuera del `<form>` que scrollea, pegado
  abajo de verdad, asociado al formulario con `form="form-protocolo-clase"`.

## Notas largas del profesor

Nuevo componente `NotaExpandible`: corta el texto a 220 caracteres con un "Ver más" /
"Ver menos". Se usa en las dos vistas de la lista de Clases que mostraban
`aclaraciones` entero.

## Visor de PDF (`VisorPDF`)

El visor viejo metía el PDF en un `<iframe>`. En Safari eso sale mal o en blanco porque
el visor nativo de PDF de Safari dentro de un iframe no es confiable. Se reemplazó por
un componente que dibuja cada página con `pdf.js` sobre un `<canvas>` (igual que ya se
usaba para contar páginas), con su propio paginador. Se agregó
`pdfjsLib.GlobalWorkerOptions.workerSrc` en `index.html`, que faltaba (sin eso, PDF.js
corre en el hilo principal y traba el celular). Se usa en `ModalPDFViewer` (visor de un
documento) y en la pestaña "PDF Hoja Doble" del editor de apuntes.

**Sin verificar de verdad:** no había ningún PDF con contenido real en los datos de
prueba disponibles, así que no se vio una página dibujada en pantalla, solo el mensaje
de "no hay datos para mostrar" (que ya existía y sigue funcionando). Tampoco hay Safari
real disponible en esta sesión. Facundo: abrí un PDF subido de verdad en el celular y
avisá si el dibujado se ve mal.

## Biblioteca de PDFs por materia

La pestaña `PDFs` de cada materia ahora filtra por unidad (chips, solo aparecen si hay
más de una unidad entre los documentos). Se pensó llamarla "Biblioteca", pero la app ya
usa ese nombre para la sección de Bibliografía ("Biblioteca General de Lecturas"):
ponerle el mismo nombre a la pestaña de al lado habría quedado confuso. Quedó como
"PDFs".

## Menú "Más" → navegación semicircular

Pedido explícito de usar la skill de animaciones. Se agrupó en 3 categorías para que
"categoría → opciones" tenga sentido:

- **Contenido:** Grabadora, Mis PDFs.
- **Estudio:** Pomodoro, Fichas, Buscar.
- **Mi Cuenta:** Mi Perfil, Ajustes.

El botón "Más" de la barra inferior mide su propia posición en pantalla al tocarlo
(`getBoundingClientRect`), y el arco se abre desde ahí — no desde un punto inventado, por
lo que funciona igual en cualquier tamaño de pantalla. Animación con transiciones CSS
(no librerías): `cubic-bezier(0.23, 1, 0.32, 1)` para la entrada de cada ítem con un
desfasaje de 35 ms entre uno y otro, `cubic-bezier(0.32, 0.72, 0, 1)` (curva de cajón
estilo iOS) para el botón central. Con `prefers-reduced-motion: reduce` los ítems
aparecen en su lugar final sin el recorrido animado, solo con un fundido de opacidad.
Se cierra tocando afuera, con Escape (un nivel por vez, como el botón central) o
eligiendo una opción.

Verificado con Chrome local a 390 px: el arco abre y cierra bien, las categorías y
subcategorías se leen completas, nada se corta ni se sale de pantalla.

## Qué no se tocó

Login, tokens y la clave de la app: sin cambios, como se pidió en la conversación
anterior sobre seguridad.
