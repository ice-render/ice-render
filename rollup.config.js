import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';
const env = process.env.NODE_ENV;
const extensions = ['.js', '.jsx', '.ts', '.tsx'];

//TODO:make lodash external library.
const CommonPlugins = [
  json(),
  nodeResolve({ extensions }),
  commonjs(),
  babel({
    extensions,
    include: ['src/**/*'],
  }),
  env === 'production' && terser(),
].filter(Boolean);
export default [
  {
    input: 'src/index.ts',
    external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
    output: [
      {
        file: pkg.main,
        format: 'cjs',
      },
      {
        file: pkg.module,
        format: 'esm',
      },
    ],
    plugins: CommonPlugins,
  },
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'boilerplate',
        file: pkg.browser,
        format: 'umd',
      },
    ],

    plugins: CommonPlugins,
  },
  {
    input: 'tests/index.ts',
    output: [
      {
        name: 'boilerplate',
        file: 'tests/index.umd.js',
        format: 'umd',
      },
    ],
    plugins: CommonPlugins,
  },
];
