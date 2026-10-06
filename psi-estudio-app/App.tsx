// PsiEstudio en una sola app: la web publicada (todo el sistema) + la grabadora nativa.
// La grabación y la transcripción viven en GrabacionProvider y en la cola: cambiar de pestaña no las corta.

import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { asegurarRaiz, recuperarSesionesInterrumpidas } from './src/almacen';
import { BarraEstado } from './src/componentes/BarraEstado';
import { GrabacionProvider } from './src/grabacion/GrabacionContext';
import { PantallaGrabar } from './src/pantallas/PantallaGrabar';
import { PantallaSitio } from './src/pantallas/PantallaSitio';
import { despertar } from './src/transcripcion';

type Pestana = 'sitio' | 'grabar';

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('sitio');

  useEffect(() => {
    // Al abrir: carpeta lista, tramo en curso recuperado, y la cola retoma lo pendiente.
    asegurarRaiz();
    void recuperarSesionesInterrumpidas().then(() => {
      despertar();
    });
  }, []);

  return (
    <GrabacionProvider>
      <SafeAreaView style={styles.app}>
        <StatusBar style="light" />
        <View style={styles.pestanas}>
          <Boton activo={pestana === 'sitio'} onPress={() => setPestana('sitio')} texto="PsiEstudio" />
          <Boton activo={pestana === 'grabar'} onPress={() => setPestana('grabar')} texto="Grabar clase" />
        </View>
        <BarraEstado />
        {/* Las dos pantallas quedan montadas: solo se oculta la que no se ve. */}
        <PantallaSitio visible={pestana === 'sitio'} />
        <PantallaGrabar visible={pestana === 'grabar'} />
      </SafeAreaView>
    </GrabacionProvider>
  );
}

function Boton({ activo, onPress, texto }: { activo: boolean; onPress: () => void; texto: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pestana, activo && styles.pestanaActiva]}>
      <Text style={[styles.pestanaTexto, activo && styles.pestanaTextoActiva]}>{texto}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#0b0f14' },
  pestanas: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pestana: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1e2a38', alignItems: 'center' },
  pestanaActiva: { backgroundColor: '#10b981' },
  pestanaTexto: { color: '#e6edf3', fontWeight: '700' },
  pestanaTextoActiva: { color: '#06261b' },
});
