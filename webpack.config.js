const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = [
  {
    mode: 'development',
    entry: './src/main/index.ts',
    target: 'electron-main',
    module: {
      rules: [{
        test: /\.ts$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      }]
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'main.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    }
  },
  {
    mode: 'development',
    entry: './src/preload/index.ts',
    target: 'electron-preload',
    module: {
      rules: [{
        test: /\.ts$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      }]
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'preload.js'
    }
  },
  {
    mode: 'development',
    entry: './src/renderer/index.tsx',
    target: 'electron-renderer',
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          include: /src/,
          use: [{ loader: 'ts-loader' }]
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        }
      ]
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'renderer.js'
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html'
      })
    ],
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx']
    }
  },
  {
    mode: 'development',
    entry: './src/cli/index.ts',
    target: 'node',
    module: {
      rules: [{
        test: /\.ts$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      }]
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'cli.js'
    },
    plugins: [
      new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })
    ],
    resolve: {
      extensions: ['.ts', '.js']
    }
  },
  {
    mode: 'development',
    entry: './src/integrations/telegram-bot.ts',
    target: 'node',
    module: {
      rules: [{
        test: /\.ts$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      }]
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'telegram-bot.js'
    },
    plugins: [
      new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })
    ],
    resolve: {
      extensions: ['.ts', '.js']
    }
  },
  {
    mode: 'development',
    entry: './src/tools/smoke-test.ts',
    target: 'node',
    module: {
      rules: [{
        test: /\.ts$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      }]
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'smoke-test.js'
    },
    plugins: [
      new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })
    ],
    resolve: {
      extensions: ['.ts', '.js']
    }
  }
];
