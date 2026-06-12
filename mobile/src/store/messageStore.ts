// =====================================================
// Akıllı Sepet - Uygulama içi mesaj / onay modalı
// Alert.alert yerine tutarlı premium UI
// =====================================================

import { create } from 'zustand';

export type MessageType = 'success' | 'error' | 'warning' | 'info';

export interface MessageAction {
  label: string;
  primary?: boolean;
  onPress?: () => void;
}

interface MessageState {
  visible: boolean;
  type: MessageType;
  title: string;
  message: string;
  actions: MessageAction[];
  show: (opts: {
    type?: MessageType;
    title: string;
    message?: string;
    actions?: MessageAction[];
  }) => void;
  hide: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  visible: false,
  type: 'info',
  title: '',
  message: '',
  actions: [{ label: 'Tamam', primary: true }],
  show: ({ type = 'info', title, message = '', actions }) =>
    set({
      visible: true,
      type,
      title,
      message,
      actions: actions ?? [{ label: 'Tamam', primary: true }],
    }),
  hide: () => set({ visible: false }),
}));

/** Alert.alert yerine kullanın */
export function showAppMessage(
  title: string,
  message?: string,
  type: MessageType = 'info',
) {
  useMessageStore.getState().show({ title, message: message ?? '', type });
}

export function showAppError(title: string, message?: string) {
  showAppMessage(title, message, 'error');
}

export function showAppSuccess(title: string, message?: string) {
  showAppMessage(title, message, 'success');
}

export function showAppConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Evet',
  cancelLabel = 'İptal',
) {
  useMessageStore.getState().show({
    type: 'warning',
    title,
    message,
    actions: [
      { label: cancelLabel, onPress: () => useMessageStore.getState().hide() },
      { label: confirmLabel, primary: true, onPress: () => { useMessageStore.getState().hide(); onConfirm(); } },
    ],
  });
}
