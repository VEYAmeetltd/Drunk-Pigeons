// TEMPORARY, sandbox-only: reduces the file-watcher count so Metro can start
// under this container's low inotify limit. Not committed to source.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.blockList = /node_modules\/react-native\/ReactAndroid\/.*|node_modules\/react-native\/sdks\/.*|(^|\/)android\/.*/;
config.watchFolders = [__dirname];

module.exports = config;
