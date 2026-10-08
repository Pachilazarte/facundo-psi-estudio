# Reglas comunes — Migración de app.jsx a Vite + componentes

Vale para todas las etapas de esta migración. Los planes de cada etapa citan esto en vez
de repetirlo.

## Qué es esto y qué NO es

Es una reorganización. **Ninguna función, componente, pantalla ni comportamiento debe
desaparecer ni cambiar lo que hace.** Se mueve código de un archivo gigante a muchos
archivos chicos, y recién al final se cambia la forma en que el navegador recibe ese
código (de "Babel compila en el celular del usuario" a "ya viene compilado de fábrica").
No es una reescritura: el objetivo es que el sistema termine haciendo exactamente lo
mismo que hoy, más rápido y más fácil de tocar.

## Por qué tantos pasos chicos

`app.jsx` tiene 10.757 líneas en un solo archivo, sin pruebas automáticas, y es el
sistema que Facundo usa todos los días en la facultad. Un cambio grande de una sola vez
no se puede revisar bien y, si rompe algo, es difícil encontrar qué fue. Haciéndolo
función por función, cada paso se puede probar solo y revertir solo si algo sale mal.

## La regla de oro de cada paso: copiar antes de borrar

Para cada función o componente que se migra:

1. Crear el archivo nuevo con el código **copiado tal cual** (sin "aprovechar para
   mejorar" de paso — eso es una tarea aparte, después).
2. Importarlo desde `app.jsx` en el lugar donde antes estaba definido, y borrar la
   definición vieja de `app.jsx` recién ahí.
3. Verificar (ver abajo) **antes** de seguir con la función siguiente.

Nunca se tocan dos funciones a la vez sin verificar entre medio.

## Dónde se trabaja

- Todo en una rama aparte: `migracion-vite`. `main` no se toca durante toda la
  migración — ahí sigue el sistema de hoy, funcionando, publicado como siempre.
- El sitio publicado (`psi-estudio.netlify.app`) sigue sirviendo desde `main` todo este
  tiempo. Nada de esta migración llega a producción hasta la etapa final, y solo
  después de que Facundo la pruebe en su teléfono y diga que sí.

## Verificación obligatoria de cada paso

1. `npx vite build` sin errores (desde la etapa 0, que es la que lo deja andando).
2. `npx vite preview` (o `vite dev`) y comparar a mano, o con el mismo método de Chrome
   local + capturas que se usó en `docs/09`, que la pantalla o función tocada se vea y
   funcione igual que en `https://psi-estudio.netlify.app` (producción, que sigue
   andando en paralelo todo el tiempo — es la referencia).
3. Revisar que ninguna otra pantalla se haya movido o roto de rebote (un repaso rápido
   de las pestañas principales, no hace falta repetir todo el checklist de `docs/06`
   en cada paso chico, sí en el cierre de cada etapa).
4. Recién con 1-3 en verde, se borra el código viejo de `app.jsx` y se marca el ítem
   como hecho en el tablero.

## El riesgo más común: una función que falta importar

Hoy todo vive en el mismo archivo, así que una función puede usar otra (`Icon`,
`triggerHaptic`, `formatTime`, `showToast`, `safeGetLocalStorage`, etc.) sin que se note
que la está usando — no hace falta importarla, ya está en el mismo scope. Al separar en
archivos, cada uso así se vuelve un `import` que hay que agregar a mano. Si falta uno,
el error no siempre aparece al cargar la página: aparece recién cuando alguien toca esa
función puntual (ej.: recién cuando alguien hace clic en "Eliminar"). Por eso cada tarea
de extracción incluye un paso fijo: **listar todos los nombres que usa el código
movido y no están definidos en el archivo nuevo, y agregarles un `import`.**

## Datos sensibles

`APP_TOKEN` y la configuración de Supabase (`SUPABASE_CONFIG`) se mueven de archivo
como cualquier otra constante, pero **el valor no se toca, no se rota, no se saca del
código del frontend.** Eso ya se decidió en una conversación anterior y sigue como
está.

## Checklist maestro (inventario de `app.jsx` al empezar esta migración)

Vive en `tareas-migracion-vite.md`. Cada función/componente tiene una fila. Se marca
`[x]` recién cuando está migrado **y** verificado según las reglas de arriba. Si al
ejecutar una etapa aparece una función que no estaba en el inventario, se agrega ahí
antes de seguir — el inventario tiene que reflejar siempre el estado real.
