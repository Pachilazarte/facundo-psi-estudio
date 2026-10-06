// Botón de toda la app: toque cómodo (al menos 44 px), texto claro y el mismo estilo en cada pantalla.

import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { TOQUE_MINIMO, tema } from '../tema';

type Variante = 'principal' | 'normal' | 'peligro';

export function Boton({
  texto,
  onPress,
  variante = 'normal',
  disabled,
  cargando,
  icono,
  style,
}: {
  texto: string;
  onPress: () => void;
  variante?: Variante;
  disabled?: boolean;
  cargando?: boolean;
  icono?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const bloqueado = Boolean(disabled || cargando);
  const colorTexto = variante === 'normal' ? tema.texto : tema.textoSobreAcento;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={bloqueado}
      style={({ pressed }) => [
        styles.base,
        variante === 'principal' && styles.principal,
        variante === 'peligro' && styles.peligro,
        variante === 'normal' && styles.normal,
        bloqueado && styles.deshabilitado,
        pressed && !bloqueado && styles.presionado,
        style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <>
          {icono ? <Feather name={icono} size={18} color={colorTexto} /> : null}
          <Text style={[styles.texto, { color: colorTexto }]}>{texto}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOQUE_MINIMO,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  principal: { backgroundColor: tema.acento },
  peligro: { backgroundColor: tema.error },
  normal: { backgroundColor: tema.superficie, borderWidth: 1, borderColor: tema.borde },
  deshabilitado: { opacity: 0.5 },
  presionado: { opacity: 0.8 },
  texto: { fontSize: 15, fontWeight: '700' },
});
