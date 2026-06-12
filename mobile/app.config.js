// Expo yapilandirmasi — opsiyonel API URL (.env bos ise Expo LAN IP kullanilir)
const appJson = require('./app.json');

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    ...(process.env.EXPO_PUBLIC_API_URL
      ? { apiUrl: process.env.EXPO_PUBLIC_API_URL }
      : {}),
  },
});
