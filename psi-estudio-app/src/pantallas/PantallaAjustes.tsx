// Ajustes: la versión que tenés instalada y acceso a las novedades.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Boton } from '../componentes/Boton';
import { VERSION_APP } from '../novedades';
import { tema } from '../tema';

export function PantallaAjustes({ visible, onVerNovedades }: { visible: boolean; onVerNovedades: () => void }) {
  return (
    <View style={[styles.contenedor, !visible && styles.oculta]}>
      <Text style={styles.titulo}>Ajustes</Text>
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Versión instalada</Text>
        <Text style={styles.valor}>{VERSION_APP}</Text>
        <Text style={styles.textoSuave}>Cuando salga una versión nueva, la app te muestra qué cambió. También podés verlo acá cuando quieras.</Text>
        <Boton texto="Ver novedades" icono="star" onPress={onVerNovedades} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo, padding: 16, gap: 14 },
  oculta: { display: 'none' },
  titulo: { color: tema.texto, fontSize: 19, fontWeight: '800' },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: tema.borde },
  etiqueta: { color: tema.textoSuave, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  valor: { color: tema.texto, fontSize: 24, fontWeight: '800' },
  textoSuave: { color: tema.textoSuave, fontSize: 13, lineHeight: 19 },
});
