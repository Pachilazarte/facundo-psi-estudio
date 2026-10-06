// PsiEstudio en la app: la web completa, la grabadora y el Historial. Las pestañas van abajo, para usarlas con una mano.

import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { iniciarCola } from './src/cola';
import { BarraEstado } from './src/componentes/BarraEstado';
import { GrabacionProvider } from './src/grabacion/GrabacionContext';
import { ModalNovedades } from './src/componentes/ModalNovedades';
import { VERSION_APP, marcarVersionVista, versionVista } from './src/novedades';
import { PantallaAjustes } from './src/pantallas/PantallaAjustes';
import { PantallaGrabar } from './src/pantallas/PantallaGrabar';
import { PantallaHistorial } from './src/pantallas/PantallaHistorial';
import { PantallaSitio } from './src/pantallas/PantallaSitio';
import { TOQUE_MINIMO, tema } from './src/tema';

type Pestana = 'sitio' | 'grabar' | 'historial' | 'ajustes';

const PESTANAS: { id: Pestana; texto: string; icono: keyof typeof Feather.glyphMap }[] = [
  { id: 'sitio', texto: 'PsiEstudio', icono: 'book-open' },
  { id: 'grabar', texto: 'Grabar', icono: 'mic' },
  { id: 'historial', texto: 'Historial', icono: 'archive' },
  { id: 'ajustes', texto: 'Ajustes', icono: 'settings' },
];

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('sitio');
  const [novedadesAbiertas, setNovedadesAbiertas] = useState(false);

  useEffect(() => {
    iniciarCola(); // sube lo pendiente y desgraba las clases guardadas
  }, []);

  // Novedades: se abren solas una vez por versión; la marca queda en el teléfono.
  useEffect(() => {
    let vivo = true;
    void versionVista().then((vista) => {
      if (vivo && vista !== VERSION_APP) setNovedadesAbiertas(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const cerrarNovedades = () => {
    setNovedadesAbiertas(false);
    marcarVersionVista(VERSION_APP);
  };

  return (
    <GrabacionProvider>
      <SafeAreaView style={styles.app}>
        <StatusBar style="dark" />
        <BarraEstado />
        <View style={styles.contenido}>
          {/* Las pantallas quedan montadas: cambiar de pestaña no recarga ni corta nada. */}
          <PantallaSitio visible={pestana === 'sitio'} />
          <PantallaGrabar visible={pestana === 'grabar'} />
          <PantallaHistorial visible={pestana === 'historial'} />
          <PantallaAjustes visible={pestana === 'ajustes'} onVerNovedades={() => setNovedadesAbiertas(true)} />
        </View>
        <ModalNovedades visible={novedadesAbiertas} onCerrar={cerrarNovedades} />
        <View style={styles.barra}>
          {PESTANAS.map((p) => {
            const activa = pestana === p.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                onPress={() => setPestana(p.id)}
                style={styles.pestana}
              >
                <Feather name={p.icono} size={22} color={activa ? tema.acento : tema.textoSuave} />
                <Text style={[styles.pestanaTexto, activa && styles.pestanaTextoActiva]}>{p.texto}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </GrabacionProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: tema.fondo },
  contenido: { flex: 1 },
  barra: {
    flexDirection: 'row',
    backgroundColor: tema.superficie,
    borderTopWidth: 1,
    borderTopColor: tema.borde,
    paddingTop: 6,
    paddingBottom: 6,
  },
  pestana: { flex: 1, minHeight: TOQUE_MINIMO, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pestanaTexto: { color: tema.textoSuave, fontSize: 12, fontWeight: '600' },
  pestanaTextoActiva: { color: tema.acento, fontWeight: '800' },
});
