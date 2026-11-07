import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * 测试配置。
 *
 * 领域逻辑（`src/domain`）与页面冒烟测试（`src/views/*.spec.ts`）共用这一份：
 * 后者要挂载真实的 `.vue` 单文件组件，因此必须挂 Vue 插件。
 *
 * 运行环境默认 node（纯逻辑够用）；页面测试在自己文件顶部用
 * `// @vitest-environment jsdom` 单独声明，不必在这一层切来切去。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
