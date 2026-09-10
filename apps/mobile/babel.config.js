module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 ships its worklets transform here; it must stay last.
    plugins: ['react-native-worklets/plugin'],
  };
};
