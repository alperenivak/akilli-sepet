// Expo Metro — NativeWind watcher Metro'yu cökerttigi icin devre disi
// (className kullanilmiyor; tum stiller StyleSheet ile)
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
