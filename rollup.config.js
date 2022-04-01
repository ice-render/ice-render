import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import strip from '@rollup/plugin-strip';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import { uglify } from 'rollup-plugin-uglify';
import pkg from './package.json';

const { visualizer } = require('rollup-plugin-visualizer');
const path = require('path');
const license = require('rollup-plugin-license');

const env = process.env.NODE_ENV;
const extensions = ['.js', '.jsx', '.ts', '.tsx'];
const CommonPlugins = [
  json(),
  nodeResolve({ extensions }),
  commonjs(),
  babel({
    extensions,
    include: ['src/**/*'],
  }),
  env === 'production' &&
    strip({
      include: ['src/**/*.(mjs|js|jsx|ts|tsx)'],
      debugger: false,
      labels: ['console'],
    }),
  env === 'production' &&
    terser({
      keep_classnames: true,
      keep_fnames: true,
    }),
  env === 'production' &&
    uglify({
      keep_fnames: true,
      output: {
        comments: function (node, comment) {
          if (comment.type === 'comment2') {
            // multiline comment
            return /@preserve|@license|@cc_on/i.test(comment.value);
          }
          return false;
        },
      },
    }),
  license({
    sourcemap: true,
    banner: {
      commentStyle: 'regular',
      content: {
        file: path.join(__dirname, 'LICENSE'),
        encoding: 'utf-8',
      },
    },
    thirdParty: {
      allow: '(MIT OR Apache-2.0)',
    },
  }),
  visualizer(),
].filter(Boolean);
const external = [...Object.keys(pkg.devDependencies || {}), ...Object.keys(pkg.peerDependencies || {})];
const globals = {};

/**
 * support config Intellisense
 * @type {import('rollup').RollupOptions[]}
 */
const configs = [
  {
    input: 'src/index.ts',
    output: {
      file: pkg.module,
      format: 'esm',
      globals: { ...globals },
    },
    plugins: CommonPlugins,
  },
  {
    input: 'src/index.ts',
    output: {
      file: pkg.main,
      format: 'cjs',
      globals: { ...globals },
    },
    plugins: CommonPlugins,
  },
  {
    input: 'src/index.ts',
    output: {
      name: 'ICE',
      file: pkg.browser,
      format: 'umd',
      globals: { ...globals },
    },
    plugins: CommonPlugins,
  },
];
export default configs;
