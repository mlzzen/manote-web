import { ref } from 'vue'

export interface ToastItem {
  id: number
  message: string
  tone: 'default' | 'danger'
}

const items = ref<ToastItem[]>([])
let nextId = 1

function push(message: string, tone: ToastItem['tone'] = 'default', duration = 2600): void {
  const id = nextId++
  items.value = [...items.value, { id, message, tone }]
  setTimeout(() => {
    items.value = items.value.filter((it) => it.id !== id)
  }, duration)
}

/** 全局轻提示。数据操作成功/失败都在这里给一句反馈。 */
export function useToast() {
  return {
    items,
    show: (message: string) => push(message, 'default'),
    error: (message: string) => push(message, 'danger', 3600),
  }
}
