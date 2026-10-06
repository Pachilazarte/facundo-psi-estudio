// PsiEstudio - Aplicación Móvil
// Carga el sistema completo PsiEstudio en pantalla completa con soporte multimedia nativo.

import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { PantallaSitio } from './src/pantallas/PantallaSitio';

export default function App() {
  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <PantallaSitio visible={true} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#FBF8F3' },
});
