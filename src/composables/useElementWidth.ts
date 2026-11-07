import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * 观测元素宽度。
 *
 * 图表用真实像素画，而不是靠 viewBox 拉伸——后者会把描边和文字一起拉变形。
 * 容器尺寸一变就重算，窗口缩放与侧栏折叠都能跟上。
 */
export function useElementWidth(target: Ref<HTMLElement | null>, fallback = 640) {
  const width = ref(fallback)
  let observer: ResizeObserver | null = null

  onMounted(() => {
    const el = target.value
    if (!el) return
    width.value = el.clientWidth || fallback
    if (typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) width.value = Math.max(120, entry.contentRect.width)
    })
    observer.observe(el)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return width
}
