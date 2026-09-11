import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import strip from '@rollup/plugin-strip';
import terser from '@rollup/plugin-terser';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = require('./package.json');
const { visualizer } = require('rollup-plugin-visualizer');
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
      // 产出独立的第三方许可声明文件：引擎把 gl-matrix 内联进了产物（零运行时依赖），
      // MIT 要求随分发保留其版权与许可声明，不能只留引擎自己的 banner。
      output: path.join(__dirname, 'dist/THIRD-PARTY-NOTICES.txt'),
    },
  }),
  visualizer(),
].filter(Boolean);
/**
 * 依赖策略：**全部内联，零运行时依赖**（`package.json` 没有 `dependencies` 字段）。
 *
 * 这里刻意不声明 rollup `external` —— gl-matrix 只列在 devDependencies，若把它设为 external，
 * 产物会去 require 一个没被声明为运行时依赖的包，下游安装后直接炸。
 * 内联的代价是产物里多几千字节，换来的是「装完即用」。
 * 内联的第三方代码必须保留版权声明，见上面 license 插件的 thirdParty.output。
 */
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
