module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // drizzle-kit's expo output imports each migration as a .sql file; this inlines it as a
      // string so Metro does not try to parse SQL as JavaScript (§7).
      ['inline-import', { extensions: ['.sql'] }],
      // Reanimated 4 ships its worklets transform here; it must stay last.
      'react-native-worklets/plugin',
    ],
  };
};
