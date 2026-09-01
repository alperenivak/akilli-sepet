// Expo yapilandirmasi — app.json + ortam degiskenleri
const appJson = require('./app.json');

/** @type {import('expo/config').ExpoConfigContext} */
module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  extra: {
    ...config.extra,
    ...appJson.expo.extra,
    eas: {
      ...config.extra?.eas,
      ...appJson.expo.extra?.eas,
      projectId: '7a06718c-ab55-48cb-9039-f0977e5887a8',
    },
    ...(process.env.EXPO_PUBLIC_API_URL
      ? { apiUrl: process.env.EXPO_PUBLIC_API_URL }
      : {}),
  },
});
