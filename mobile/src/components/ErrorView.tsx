// Hata durumu — premium StateView sarmalayıcısı
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StateView } from './ui/StateViews';
import { COLORS } from '../utils/constants';

interface ErrorViewProps {
  message?: string;
  subtitle?: string;
  onRetry?: () => void;
  offline?: boolean;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  message = 'Bir hata oluştu',
  subtitle,
  onRetry,
  offline = false,
}) => (
  <View style={styles.container}>
    <StateView
      kind={offline ? 'offline' : 'error'}
      title={message}
      subtitle={subtitle}
      onRetry={onRetry}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
});
