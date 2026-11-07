import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useDataStore } from './stores/data'
import { createSampleData } from './data/sample'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

/**
 * `?demo=1` 时，如果本机还没有任何记录，就铺一份示例数据。
 *
 * 用途是截图、演示与「先看看分析长什么样」：只在库为空时生效，
 * 因此不会覆盖任何真实记录。
 */
if (new URLSearchParams(window.location.search).get('demo') === '1') {
  const store = useDataStore(pinia)
  if (store.activeSessions.length === 0 && store.trashedSessions.length === 0) {
    store.replaceAll(createSampleData())
  }
}

app.mount('#app')
