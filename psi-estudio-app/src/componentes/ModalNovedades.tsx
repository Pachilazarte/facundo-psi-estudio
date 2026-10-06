// Aviso con lo que cambió en la versión. Se abre sola una vez por versión y también desde Ajustes.

import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NOVEDADES } from '../novedades';
import { tema } from '../tema';
import { Boton } from './Boton';

export function ModalNovedades({ visible, onCerrar }: { visible: boolean; onCerrar: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.velo}>
        <View style={styles.hoja}>
          <View style={styles.encabezado}>
            <Feather name="star" size={20} color={tema.acentoIcono} />
            <Text style={styles.titulo}>Novedades de PsiEstudio</Text>
          </View>
          <ScrollView contentContainerStyle={styles.lista}>
            {NOVEDADES.map((n) => (
              <View key={n.version} style={styles.bloque}>
                <Text style={styles.version}>
                  Versión {n.version} · {n.fecha}
                </Text>
                {n.cambios.map((c) => (
                  <View key={c} style={styles.fila}>
                    <Feather name="check" size={16} color={tema.acentoIcono} style={styles.marca} />
                    <Text style={styles.cambio}>{c}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <Boton texto="Entendido" variante="principal" onPress={onCerrar} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  velo: { flex: 1, backgroundColor: tema.velo, justifyContent: 'center', padding: 16 },
  hoja: { backgroundColor: tema.superficie, borderRadius: 18, padding: 18, gap: 14, maxHeight: '85%' },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { color: tema.texto, fontSize: 18, fontWeight: '800' },
  lista: { gap: 16 },
  bloque: { gap: 8 },
  version: { color: tema.textoSuave, fontSize: 12, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  marca: { marginTop: 2 },
  cambio: { flex: 1, color: tema.texto, fontSize: 15, lineHeight: 21 },
});
