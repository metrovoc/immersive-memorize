const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = (_env, argv) => ({
  entry: {
    background: './src/background.ts',
    'content-script': './src/content-script/index.ts',
    'popup/popup': './src/popup/popup.ts',
    'options/options': './src/options/options.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: { transpileOnly: true },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: '[name].css' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json' },
        { from: 'icons', to: 'icons' },
        { from: '_locales', to: '_locales' },
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'src/options/options.html', to: 'options/options.html' },
        // Ships the gzipped kuromoji dictionaries; they are decompressed at runtime.
        {
          from: 'node_modules/@patdx/kuromoji/dict/*.dat.gz',
          to: 'dict/kuromoji/[name][ext]',
        },
        {
          from: 'dict/*.json',
          to: 'dict/[name][ext]',
          transform: content => JSON.stringify(JSON.parse(content.toString())),
        },
      ],
    }),
  ],
  devtool: argv.mode === 'development' ? 'cheap-module-source-map' : false,
  performance: { hints: false },
})
