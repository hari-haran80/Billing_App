const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  alias: {
    '@': path.resolve(__dirname),
    '@components': path.resolve(__dirname, 'components'),
    '@app': path.resolve(__dirname, 'app'),
    '@lib': path.resolve(__dirname, 'lib'),
    '@types': path.resolve(__dirname, 'app/types'),
  },
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  },
};

module.exports = config;