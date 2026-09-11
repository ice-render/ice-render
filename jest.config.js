module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(ts|js)$': 'babel-jest',
  },
  // 覆盖率统计**全量 src**（不设该项时只统计「被测试触达的文件」，数字会虚高）
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text-summary', 'lcov'],
  // 门槛是「只允许往上调」的棘轮：按 2026-09-11 实测基线（语句 67.7% / 分支 61.8% /
  // 函数 76.1% / 行 67.6%）向下留出余量。覆盖率下降即失败；
  // 覆盖率提升后请同步上调这些数字（不要下调）。
  coverageThreshold: {
    global: {
      statements: 65,
      branches: 58,
      functions: 72,
      lines: 65,
    },
  },
};
