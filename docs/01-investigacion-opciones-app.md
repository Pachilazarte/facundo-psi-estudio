# Investigación: cómo tener PsiEstudio como app (grabar y transcribir desde el celular)

**Fecha:** 2026-10-05
**Estado:** investigación. Ninguna opción de esta lista está probada en un teléfono real todavía.

---

## 1. Qué necesita la app

Criterios que pidió el dueño, en orden:

1. **Gratis** (o lo más barato posible).
2. **Rápido** de armar y de instalar.
3. **Grabar la clase con el teléfono bloqueado o en segundo plano.** Sin esto, la app no sirve para clases largas.
4. **Transcribir** en la nube (Groq, a través de la función de Netlify) y guardar en la base (Supabase).
5. **Una sola app**, con grabadora, desgrabación y datos.

El punto 3 es el que decide casi todo. Una web no lo cumple en iPhone (ver opción A).

---

## 2. Opciones evaluadas

### Opción A: web instalada en la pantalla de inicio (PWA / acceso directo)

- **Costo:** gratis.
- **Qué se hace:** abrir psi-estudio.netlify.app en Safari y "Agregar a la pantalla de inicio".
- **Resultado:** el dueño la probó y **la descartó**: Safari corta el micrófono cuando el teléfono se bloquea o cambia de app.
- **Evidencia:** reportes de usuarios sobre micrófono y Safari en iOS (foros y repos de terceros). No es documentación oficial de Apple, así que se toma como señal, no como prueba.
- **Veredicto:** **no sirve** para grabar clases en iPhone.

### Opción B: Expo Go (la app de Expo para probar proyectos sin compilar)

- **Costo:** gratis. No hace falta compilar ni cuenta paga.
- **Problema:** la documentación oficial de `expo-audio` no confirma si la grabación en segundo plano funciona dentro de Expo Go en iOS. Otra fuente dice que no. **No está verificado.**
- **Veredicto:** **no conviene apostar** a la grabación en segundo plano con esta opción sin probarla antes en un teléfono real. Sirve para ver la interfaz, no para garantizar la grabación.
- **Fuente:** https://docs.expo.dev/versions/latest/sdk/audio/ (la página describe `enableBackgroundRecording`, que en iOS "adds the audio background mode"; eso requiere una build propia, no Expo Go).

### Opción C: app nativa para Android con EAS Build (plan gratis)

- **Costo:** gratis. El plan Free de EAS incluye **15 builds de Android por mes** y 15 de iOS. Cola de baja prioridad (puede demorar más en horas pico) y timeout de **45 minutos** por build.
- **Instalación:** el APK se instala directo en el teléfono. **No vence.** No hace falta cuenta paga de Google.
- **Background:** Expo documenta que, en Android, la grabación en segundo plano agrega permisos de servicio en primer plano y de micrófono en el servicio (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS`).
- **Veredicto:** **es la opción gratis más sólida** para grabar en segundo plano. Hay que probarla en un Android real.
- **Fuentes:**
  - https://expo.dev/pricing (límites del plan Free, verificado con la página).
  - https://docs.expo.dev/versions/latest/sdk/audio/ (permisos de segundo plano en Android).

### Opción D: iPhone con Mac y cuenta gratis de Apple (firma de 7 días)

- **Costo:** gratis si tenés un Mac. Xcode es gratis, y con un Apple ID normal se puede firmar para tu propio teléfono.
- **Límites oficiales de Apple** (página "Enable a personal team in Xcode", en https://developer.apple.com/support/compare-memberships/):
  - El perfil de la app **vence a los 7 días**. Hay que recompilar y reinstalar.
  - Máximo **3 apps** instaladas por dispositivo.
  - Máximo **10 App IDs** y **3 dispositivos** registrados, que también vencen a los 7 días.
- **Sin Mac:** no hay una ruta gratis que yo haya verificado para compilar iOS. Ver opción G.
- **Herramienta sin Mac para reinstalar:** Sideloadly (gratis, Windows y macOS) reinstala con el Apple ID gratis y puede renovar automáticamente si el teléfono está conectado (https://sideloadly.io/faq.html). Pero para eso hace falta un archivo `.ipa` ya compilado, y eso necesita un Mac.
- **Veredicto:** **gratis si tenés Mac**, con reinstalación semanal.

### Opción E: iPhone con cuenta paga de Apple Developer (USD 99 por año)

- **Costo:** USD 99 por año.
- **Qué permite:** compilar con EAS para iPhone sin Mac. Expo indica que las builds de dispositivo iOS (ad hoc) "require a paid Apple Developer account" (https://docs.expo.dev/build/internal-distribution/). Expo también documenta los roles y permisos necesarios en https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/.
- **Límites:** la app dura un año, sin reinstalar cada semana.
- **Veredicto:** **la única opción sin Mac que yo verifiqué para iPhone**, pero no es gratis.

### Opción F: compilar iOS en GitHub Actions (gratis con repo público)

- **Idea original:** usar los runners de macOS de GitHub, que serían gratis porque el repo es público.
- **Lo que dice la documentación oficial:** el uso gratis en repos públicos aplica **solo a runners de Linux**. Los runners de macOS y Windows se cobran aunque el repo sea público (https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions).
- **Veredicto:** **descartada**. Una búsqueda automática dio otra cosa; la documentación oficial la corrige.

### Opción G: Mac prestada, de un amigo o un servicio

- Permite la opción D sin comprar nada. Depende de que consigas acceso a un Mac.
- **No verificado** qué servicios de Mac en la nube son gratis hoy.

---

## 3. Resumen comparativo

| Opción | Costo | Grabación con pantalla bloqueada | Dura | Compila sin Mac | Estado |
|---|---|---|---|---|---|
| A. Web en pantalla de inicio | Gratis | No (Safari corta) | Siempre | Sí | **Descartada** |
| B. Expo Go | Gratis | No verificado | Siempre | Sí | Sin verificar |
| C. APK Android (EAS Free) | Gratis | Sí (con servicio en primer plano) | Siempre | Sí | **Recomendada** |
| D. iPhone con Mac y Apple ID gratis | Gratis | Sin verificar en la app | **7 días** | No | Posible |
| E. iPhone con cuenta paga | USD 99/año | Sin verificar en la app | 1 año | Sí | Posible |
| F. GitHub Actions para iOS | No es gratis | — | — | — | **Descartada** |
| G. Mac prestada | Gratis | Sin verificar en la app | 7 días (con firma gratis) | Sí | Depende de acceso |

---

## 4. Conclusión

- **Para Android:** la opción C es gratis, rápida y no vence. Es la que conviene empezar.
- **Para iPhone:** **no existe una ruta gratis verificada** que permita grabar en segundo plano sin reinstalar cada 7 días. Las únicas dos rutas reales son:
  1. Tener acceso a un Mac (opción D), con reinstalación semanal.
  2. Pagar USD 99 por año (opción E), sin reinstalación.
- **Lo que no se puede asegurar con esta investigación:** que la grabación en segundo plano funcione en iPhone con una app compilada. Eso se confirma solo probándolo en un teléfono real.

---

## 5. Pasos para la opción recomendada (Android, EAS Free)

1. Crear cuenta en Expo: https://expo.dev/signup
2. En la carpeta `psivoice-mobile/`, instalar EAS CLI: `npm install -g eas-cli`
3. Iniciar sesión: `eas login`
4. Configurar el proyecto: `eas build:configure`
5. Compilar el APK de prueba: `eas build -p android --profile preview`
6. Al terminar, Expo da un enlace de descarga. Abrirlo en el teléfono Android e instalar el APK (hay que permitir "instalar apps desconocidas").
7. Probar: grabar 3 minutos con la pantalla bloqueada, pausar una vez, y cortar.

Documentación oficial de los pasos: https://docs.expo.dev/build/setup/ y https://docs.expo.dev/build/internal-distribution/

---

## 6. Fuentes consultadas

- https://expo.dev/pricing (límites del plan Free de EAS Build)
- https://docs.expo.dev/versions/latest/sdk/audio/ (grabación en segundo plano, permisos)
- https://docs.expo.dev/build/internal-distribution/ (distribución interna, cuenta paga para iOS)
- https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/ (roles de Apple para EAS)
- https://docs.expo.dev/build/setup/ (crear la primera build)
- https://developer.apple.com/support/compare-memberships/ (límites de la cuenta gratis: 7 días, 3 apps)
- https://sideloadly.io/faq.html (reinstalación con Apple ID gratis)
- https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions (runners gratis solo en Linux)

**Búsquedas automáticas que no se tomaron como verdad:** una búsqueda sobre GitHub Actions dio que era gratis para macOS en repos públicos, y la documentación oficial lo desmiente. Otra búsqueda sobre Safari y el micrófono se basó en reportes de usuarios, no en documentación de Apple.
