const path = require('path');
const tsConfigPaths = require('tsconfig-paths');

const configResult = tsConfigPaths.loadConfig(__dirname);

if (configResult.resultType === 'failed') {
  throw new Error(`Failed to load tsconfig for path mapping: ${configResult.message}`);
}

tsConfigPaths.register({
  baseUrl: path.resolve(__dirname, 'dist'),
  paths: configResult.paths || {},
});
