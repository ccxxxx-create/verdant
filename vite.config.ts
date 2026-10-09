import { defineConfig } from 'vitest/config';

// GitHub Pages 子路径部署：base 必须与仓库名一致（Vite 官方 static-deploy 方案）
export default defineConfig({
  base: '/verdant/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
