import React from 'react';
import { View, StyleSheet } from 'react-native';

interface WaveformVisualizerProps {
  meteringValues: number[]; // Array de los últimos 25 valores de decibeles (-160 a 0)
  isRecording: boolean;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ meteringValues, isRecording }) => {
  return (
    <View style={styles.container}>
      {meteringValues.map((db, idx) => {
        // Normalizar dB (-60 dB a 0 dB) en altura proporcional (4px a 64px)
        const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
        const barHeight = isRecording ? Math.max(6, normalized * 64) : 6;

        return (
          <View
            key={idx}
            style={[
              styles.bar,
              {
                height: barHeight,
                backgroundColor: isRecording ? '#00e599' : '#334155',
                opacity: isRecording ? 0.4 + normalized * 0.6 : 0.3,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    gap: 3,
    paddingHorizontal: 16,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
