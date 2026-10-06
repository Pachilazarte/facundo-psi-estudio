// PsiEstudio en una sola app: la web (todo el sistema), la grabadora y el Historial.
// Todo se guarda en la base (Supabase), igual que la web. La grabadora y la desgrabación siguen aunque cambies de pestaña.

import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { iniciarCola } from './src/cola';
import { BarraEstado } from './src/componentes/BarraEstado';
import { GrabacionProvider } from './src/grabacion/GrabacionContext';
import { PantallaGrabar } from './src/pantallas/PantallaGrabar';
import { PantallaHistorial } from './src/pantallas/PantallaHistorial';
import { PantallaSitio } from './src/pantallas/PantallaSitio';

type Pestana = 'sitio' | 'grabar' | 'historial';

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'sitio', texto: 'PsiEstudio' },
  { id: 'grabar', texto: 'Grabar' },
  { id: 'historial', texto: 'Historial' },
];

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('sitio');

  useEffect(() => {
    iniciarCola(); // sube lo pendiente y desgraba las cargas de la base
  }, []);

  return (
    <GrabacionProvider>
      <SafeAreaView style={styles.app}>
        <StatusBar style="light" />
        <View style={styles.pestanas}>
          {PESTANAS.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => setPestana(p.id)} style={[styles.pestana, pestana === p.id && styles.pestanaActiva]}>
              <Text style={[styles.pestanaTexto, pestana === p.id && styles.pestanaTextoActiva]}>{p.texto}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <BarraEstado />
        {/* Las pantallas quedan montadas: cambiar de pestaña no recarga ni corta nada. */}
        <PantallaSitio visible={pestana === 'sitio'} />
        <PantallaGrabar visible={pestana === 'grabar'} />
        <PantallaHistorial visible={pestana === 'historial'} />
      </SafeAreaView>
    </GrabacionProvider>
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
