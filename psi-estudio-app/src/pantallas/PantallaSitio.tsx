// PsiEstudio completo (materias, bibliografía, clases, apuntes, exámenes) es la web publicada.
// Queda siempre montada: al cambiar de pestaña no se recarga ni pierde lo que estabas viendo.

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SITIO_URL } from '../config';

export function PantallaSitio({ visible }: { visible: boolean }) {
  return (
    <View style={[styles.contenedor, !visible && styles.oculta]}>
      <WebView
        source={{ uri: SITIO_URL }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        startInLoadingState
        renderLoading={() => (
          <View style={styles.cargando}>
            <ActivityIndicator color="#10b981" />
          </View>
        )}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FBF8F3' },
  oculta: { display: 'none' },
  web: { flex: 1 },
  cargando: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF8F3',
  },
});
