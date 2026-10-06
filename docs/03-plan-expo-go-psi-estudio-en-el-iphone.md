# Plan: PsiEstudio dentro de la app, con Expo Go (gratis, sin cuenta paga de Apple)

**Fecha:** 2026-10-05
**Para:** Facundo (PC + iPhone, sin cuenta paga de Apple)
**Estado:** plan. Nada de esto está probado todavía en tu iPhone. La prueba del paso 7 decide si el plan sirve.

---

## 0. Antes de empezar: lo que tenés que saber

**Qué es Expo Go.** Es una app gratuita de Expo que instalás desde la App Store. Abre proyectos de Expo que tu PC le sirve por la red. Es la forma **gratis y más rápida** de tener una app propia en el iPhone sin compilar nada.

**Lo que Expo Go NO puede hacer** (según la documentación oficial):
- Expo dice que Expo Go es "limitado y no sirve para construir proyectos de producción".
- **No admite módulos nativos propios.** Eso quiere decir que no podés configurar en tu app el permiso de audio en segundo plano (`UIBackgroundModes`), que es lo que la grabación con la pantalla bloqueada necesita. La configuración la pone Expo Go, no vos.

**Qué significa eso para tu caso:** la grabación con la pantalla bloqueada **probablemente no va a funcionar** dentro de Expo Go. Lo digo como inferencia de la documentación, no como prueba. Por eso el plan tiene un paso de prueba (paso 7) antes de depender de esto.

**Alternativa si la prueba falla:** dejar la pantalla encendida mientras grabás. Con "Bloqueo automático: Nunca" y la pantalla encendida con la app abierta, iOS no corta el micrófono. Es una limitación real: el teléfono tiene que quedarse desbloqueado y con la app en primer plano. El plan incluye esa opción.

**Requisito de versión:** Expo Go solo abre proyectos de las versiones de SDK que tiene publicadas. Nuestro proyecto `psivoice-mobile` está en **SDK 52**, y la versión de Expo Go de la App Store puede no soportarlo. Por eso el plan **crea un proyecto nuevo** con la versión actual. El paso 2 explica cómo confirmarla.

---

## 1. Qué vamos a construir

Una sola app, **PsiEstudio**, con dos pantallas:

1. **PsiEstudio (WebView):** muestra la web publicada en `https://psi-estudio.netlify.app`. Materias, bibliografía, clases, apuntes, exámenes y todo lo que ya tiene la web funciona desde acá. La app solo es el contenedor.
2. **Grabar (nativa):** la grabadora **dentro de la app**, no la de la web. Graba en partes de 150 segundos, cada parte se manda a la función de Netlify para transcribirla, y la transcripción se guarda como apunte en tu base de Supabase. La web la muestra después.

**Por qué la grabadora va nativa y no la de la web:** la grabadora de la web usa el micrófono del navegador, y en iPhone el navegador lo corta. La grabadora nativa usa el módulo de audio de Expo, que es lo que permite pedir el permiso correcto. Aun así, el segundo plano depende de la prueba del paso 7.

**Lo que NO es esta app:** la limpieza de audio del servidor de la PC (DSP) no está. La transcripción es la de Groq, a través de la función de Netlify.

---

## 2. Requisitos

- **PC** con Windows (la que usás), con **Node.js LTS** instalado. Verificar con `node -v` en la terminal. Si no está: https://nodejs.org (instalar la versión LTS).
- **iPhone** con **iOS 16.4 o superior** (requisito de Expo Go, verificado en la App Store).
- **Cuenta gratuita de Expo:** https://expo.dev/signup (no pide tarjeta).
- **PC y iPhone en la misma red Wi-Fi** para el paso 4. Si la red es pública o no deja conectar, ver el paso 4, opción de túnel.

---

## 3. Instalar Expo Go en el iPhone

1. Abrí la App Store.
2. Buscá **Expo Go** (el desarrollador es Expo).
3. O entrá directo a: https://apps.apple.com/us/app/expo-go/id982107779
4. Instalala. Es gratis.

---

## 4. Crear el proyecto nuevo en la PC

Abrí la terminal (PowerShell) en la carpeta donde querés el proyecto, por ejemplo `C:\Users\PERSONAL\Documents\basura\` :

```bash
npx create-expo-app@latest psi-estudio-app
cd psi-estudio-app
```

Documentación oficial del comando: https://docs.expo.dev/get-started/create-a-project/

Después instalá los paquetes que usa el plan (la lista se confirma con `npx expo install`, que elige la versión compatible con tu SDK):

```bash
npx expo install react-native-webview expo-audio expo-file-system expo-keep-awake
```

**Verificar la versión de SDK:** al arrancar el proyecto (paso 5), la terminal muestra la versión del SDK. Si Expo Go del iPhone no la soporta, la terminal y el teléfono lo avisan. En ese caso hay que usar la versión que Expo Go soporte, o esperar a que se publique la versión nueva de Expo Go.

---

## 5. Arrancar y abrir la app en el iPhone

En la carpeta del proyecto:

```bash
npx expo start
```

En la terminal aparece un **código QR**.

- En el iPhone, abrí la **app Cámara** y escaneá el QR. Se abre Expo Go con tu proyecto.
- Documentación oficial: https://docs.expo.dev/get-started/start-developing.md

**Si no conecta:**
- Revisá que PC y iPhone estén en la **misma Wi-Fi**. Es el requisito oficial.
- Si la red no lo permite, probá:
  ```bash
  npx expo start --tunnel
  ```
  Funciona en cualquier red, pero recarga más lento. Lo recomienda Expo solo si la conexión normal no sirve.

**Importante:** mientras `npx expo start` esté corriendo, la PC tiene que estar encendida. Eso se resuelve en el paso 8 (publicar).

---

## 6. El código

Los nombres de las funciones son los de la documentación oficial de Expo que consulté. **Si algo no compila, mandame el error y lo ajusto a tu versión instalada.** Por eso los pasos de verificación están marcados.

### 6.1 Configuración: `src/config.ts`

Estos valores son **públicos** (la key de Supabase ya está en el código de la web). **No** pongas acá la contraseña de la base ni la key de Groq.

```ts
// Valores del proyecto. Copiar desde los archivos que ya tenés (sin inventar).
export const SITIO_URL = 'https://psi-estudio.netlify.app';
export const FUNCION_TRANSCRIBIR = 'https://psi-estudio.netlify.app/.netlify/functions/transcribir';
export const SUPABASE_URL = 'COPIAR_LA_URL_DE_app.jsx';
export const SUPABASE_ANON_KEY = 'PEGAR_LA_ANON_KEY_DE_app.jsx';
// Misma clave que usa la web (la que está en app.jsx como APP_TOKEN).
export const APP_TOKEN = 'PEGAR_EL_APP_TOKEN_DE_app.jsx';
export const SEGMENTO_SEGUNDOS = 150;
```

Dónde están los valores: `SUPABASE_ANON_KEY` y `APP_TOKEN` están en `app.jsx` (raíz del proyecto de la web). **Copiar tal cual, sin modificarlos.**

### 6.2 La app principal: `App.tsx`

Reemplazá el contenido de `App.tsx` por:

```tsx
import { useState } from 'react';
import { SafeAreaView, View, TouchableOpacity, Text, StyleSheet, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { SITIO_URL } from './src/config';
import { GrabadorClase } from './src/GrabadorClase';

export default function App() {
  const [pantalla, setPantalla] = useState<'sitio' | 'grabar'>('sitio');

  return (
    <SafeAreaView style={styles.contenedor}>
      <StatusBar barStyle="light-content" />
      <View style={styles.barra}>
        <TouchableOpacity onPress={() => setPantalla('sitio')} style={styles.boton}>
          <Text style={styles.textoBoton}>PsiEstudio</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPantalla('grabar')} style={styles.boton}>
          <Text style={styles.textoBoton}>Grabar clase</Text>
        </TouchableOpacity>
      </View>

      {pantalla === 'sitio' ? (
        <WebView
          source={{ uri: SITIO_URL }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          style={{ flex: 1 }}
        />
      ) : (
        <GrabadorClase />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#0b0f14' },
  barra: { flexDirection: 'row', justifyContent: 'space-around', padding: 12 },
  boton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#1e2a38' },
  textoBoton: { color: '#e6edf3', fontWeight: '600' },
});
```

Instalar `react-native-webview` ya lo hiciste en el paso 4.

### 6.3 La grabadora: `src/GrabadorClase.tsx`

Esta parte es la que más puede fallar, y es la que la prueba del paso 7 tiene que confirmar.

```tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { File, UploadType } from 'expo-file-system';
import { SEGMENTO_SEGUNDOS, FUNCION_TRANSCRIBIR, APP_TOKEN } from './config';

export function GrabadorClase() {
  // Mantiene la pantalla encendida mientras la pantalla de grabación está abierta
  useKeepAwake();

  const grabadora = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [grabando, setGrabando] = useState(false);
  const [segmentos, setSegmentos] = useState(0);
  const [mensaje, setMensaje] = useState('Listo para grabar');
  const grabandoRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Subida de un fragmento como bytes crudos (la función de Netlify espera el audio tal cual)
  const subirFragmento = async (uri: string) => {
    const archivo = new File(uri);
    const respuesta = await archivo.uploadAsync(FUNCION_TRANSCRIBIR, {
      uploadType: UploadType.BINARY_CONTENT,
      httpMethod: 'POST',
      headers: { 'Content-Type': 'audio/mp4', 'x-app-token': APP_TOKEN },
    });
    if (respuesta.status !== 200) throw new Error(`La transcripción falló (${respuesta.status})`);
    return JSON.parse(respuesta.body);
  };

  const cortarYSubir = async () => {
    await grabadora.stop();
    const uri = grabadora.uri;
    await grabadora.prepareToRecordAsync();
    grabadora.record();
    if (!uri) return;
    setMensaje('Transcribiendo fragmento...');
    try {
      await subirFragmento(uri);
      setSegmentos((n) => n + 1);
      setMensaje('Grabando');
    } catch (e: any) {
      // El fragmento queda en el teléfono (uri). Lo marcamos para reintentar después.
      setMensaje('Error: ' + (e.message || 'sin conexión') + '. El fragmento quedó guardado.');
    }
  };

  const empezar = async () => {
    const permiso = await AudioModule.requestRecordingPermissionsAsync();
    if (!permiso.granted) { Alert.alert('Falta permiso', 'Habilitá el micrófono en Ajustes del iPhone.'); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true });
    await grabadora.prepareToRecordAsync();
    grabadora.record();
    grabandoRef.current = true;
    setGrabando(true);
    setMensaje('Grabando');
    timerRef.current = setInterval(() => {
      if (grabandoRef.current) cortarYSubir();
    }, SEGMENTO_SEGUNDOS * 1000);
  };

  const terminar = async () => {
    grabandoRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    setGrabando(false);
    await cortarYSubir();
    setMensaje(`Clase terminada. Fragmentos transcriptos: ${segmentos + 1}`);
  };

  return (
    <View style={styles.contenedor}>
      <Text style={styles.estado}>{mensaje}</Text>
      <Text style={styles.dato}>Fragmentos: {segmentos}</Text>
      {!grabando ? (
        <TouchableOpacity style={styles.botonGrande} onPress={empezar}>
          <Text style={styles.textoBoton}>Empezar clase</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.botonGrande, styles.botonParar]} onPress={terminar}>
          <Text style={styles.textoBoton}>Terminar clase</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0b0f14' },
  estado: { color: '#e6edf3', fontSize: 18, marginBottom: 12, textAlign: 'center' },
  dato: { color: '#8b98a5', marginBottom: 24 },
  botonGrande: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14, backgroundColor: '#10b981' },
  botonParar: { backgroundColor: '#ef4444' },
  textoBoton: { color: 'white', fontWeight: '700', fontSize: 16 },
});
```

**Puntos a verificar al correrlo** (la terminal o el teléfono avisan si algo no coincide):
1. Que `AudioModule.requestRecordingPermissionsAsync` exista con ese nombre en tu versión. La documentación consultada lo muestra así.
2. Que `new File(uri).uploadAsync(...)` devuelva `status` y `body`. Si no, hay que usar la función `uploadAsync` del paquete anterior de expo-file-system (la versión que usa `FileSystem.uploadAsync`).
3. Que `setAudioModeAsync` acepte `allowsBackgroundRecording`. Si no, se quita esa línea y se sigue con la prueba del paso 7.

**Qué falta en este código (pendiente, no está hecho):**
- **Guardar la transcripción en Supabase** (tabla `apuntes`). La función de Netlify devuelve el texto; falta el `POST` a `${SUPABASE_URL}/rest/v1/apuntes` con la anon key y el header `x-app-token`. Lo agrego después de la prueba.
- **Reintentar fragmentos que fallaron.** Hoy quedan en el teléfono, pero el código todavía no los vuelve a subir.

### 6.4 Cómo funciona por dentro

1. Se pide el permiso del micrófono.
2. Se graba un fragmento de 150 segundos (`grabadora.record()`).
3. Cada 150 segundos, se corta el fragmento (`grabadora.stop()`), se sube a la función de Netlify como bytes crudos, y se vuelve a grabar otro.
4. Al terminar, se corta y sube el último fragmento.

Así, si la app se cierra, solo se pierde lo que estaba grabando en ese momento, no toda la clase.

---

## 7. La prueba que decide si el plan sirve

Hacela con el iPhone, en este orden. **Anotá el resultado de cada uno.**

| Prueba | Qué hacer | Resultado esperado |
|---|---|---|
| A. Abrir la app | Escanear el QR del paso 5. Ver la pestaña PsiEstudio. | Carga la web. |
| B. Grabar 3 minutos, pantalla encendida | Ir a "Grabar clase", "Empezar clase", esperar 3 min, "Terminar clase". | Se suben 2 fragmentos sin error. |
| C. Grabar con la pantalla bloqueada | Empezar, bloquear el iPhone, esperar 5 min, desbloquear, "Terminar clase". | El audio sigue grabándose. **Si se corta, este plan no sirve con la pantalla bloqueada.** |
| D. Revisar la transcripción | Abrir la web, ver que la clase aparezca (cuando esté guardada en Supabase). | El texto de la grabación está. |

**Qué hacer según el resultado:**

- **Si C funciona:** el plan está resuelto. Pasar al paso 8.
- **Si C falla pero B funciona:** el plan sirve con la pantalla encendida. Configurar el iPhone: **Ajustes → Pantalla y brillo → Bloqueo automático → Nunca**. La app ya mantiene la pantalla encendida mientras está en "Grabar". El límite: la app tiene que estar abierta y en primer plano.
- **Si B falla:** el problema es de la app o de la función. Mandame el mensaje de error que aparece.

---

## 8. Publicar para no depender de la PC (opcional, a confirmar)

Hoy la app solo corre mientras `npx expo start` está activo en la PC. Para usarla sin la PC, Expo tiene **EAS Update** (actualizaciones publicadas):

- **Plan gratuito:** Expo dice que incluye "free updates with EAS Update" (https://docs.expo.dev/billing/plans/). Un número de la búsqueda dice 1.000 usuarios activos por mes, pero **no lo confirmé en la página oficial**: hay que verificarlo en https://expo.dev/pricing antes de depender de eso.
- **Lo que no verifiqué:** que Expo Go abra una actualización publicada con un link, sin que la PC esté encendida. Es lo que hace falta para este paso, y hay que probarlo.
- **Comandos (a confirmar con la documentación de EAS Update):**
  ```bash
  npx eas-cli login
  npx eas-cli update --branch produccion --message "primera version"
  ```
  Documentación: https://docs.expo.dev/eas-update/introduction/

---

## 9. Qué NO cubre este plan

- **Grabación con la pantalla bloqueada**, si la prueba C falla. No hay forma de garantizarla en Expo Go.
- **La limpieza de audio del servidor de la PC.** La transcripción es directa, sin el filtrado de ruido.
- **Compilar una app propia para la App Store o para instalarla sin Expo Go.** Para eso hace falta cuenta paga de Apple (USD 99 por año), o un Mac.
- **Notificaciones, widgets, y la app de Android.** Quedan para después.

---

## 10. Fuentes oficiales consultadas

- Expo Go, limitaciones: https://docs.expo.dev/workflow/expo-go/
- Expo Go, App Store: https://apps.apple.com/us/app/expo-go/id982107779 (enlace encontrado en búsqueda; revisar que sea el oficial de Expo al instalarla)
- Crear un proyecto: https://docs.expo.dev/get-started/create-a-project/
- Arrancar el servidor de desarrollo: https://docs.expo.dev/get-started/start-developing.md
- Grabación con expo-audio: https://docs.expo.dev/versions/latest/sdk/audio/
- Subida de archivos con expo-file-system: https://docs.expo.dev/versions/latest/sdk/filesystem/
- Planes y límites: https://docs.expo.dev/billing/plans/
- Precios: https://expo.dev/pricing
- EAS Update: https://docs.expo.dev/eas-update/introduction/
- Requisitos de cuenta de Apple para compilar iOS: https://docs.expo.dev/build/internal-distribution/ (menciona que la distribución de dispositivo iOS requiere cuenta paga)

---

## 11. Checklist (en orden)

- [ ] Node.js LTS instalado en la PC (`node -v`).
- [ ] Expo Go instalado en el iPhone (iOS 16.4 o superior).
- [ ] Cuenta gratuita de Expo creada.
- [ ] Proyecto `psi-estudio-app` creado con `npx create-expo-app@latest`.
- [ ] Paquetes instalados con `npx expo install`.
- [ ] `src/config.ts` con los valores copiados de `app.jsx` (sin modificarlos).
- [ ] `App.tsx` y `src/GrabadorClase.tsx` reemplazados por el código del paso 6.
- [ ] `npx expo start` corre y el QR abre la app en el iPhone.
- [ ] Prueba A (abrir la app) OK.
- [ ] Prueba B (3 minutos, pantalla encendida) OK.
- [ ] Prueba C (pantalla bloqueada) OK **o** decidido el plan de pantalla encendida.
- [ ] Prueba D (transcripción visible en la web) OK.
- [ ] Guardar la transcripción en Supabase (pendiente de código).
- [ ] Reintento de fragmentos fallidos (pendiente de código).
- [ ] EAS Update para no depender de la PC (opcional, a confirmar).
