/** 在浏览器里触发一次文件下载。 */
export function downloadText(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // 立刻撤销会让部分浏览器（Safari）拿不到内容，延后一拍再释放
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 让用户挑一个文件并读成文本；取消或读取失败时返回 null。 */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    let settled = false
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(value)
    }
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        finish(null)
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        finish(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => finish(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => finish(null)
      reader.readAsText(file, 'utf-8')
    })
    // 用户取消时不会触发 change；页面重新获得焦点后兜底清理
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) finish(null)
        }, 500)
      },
      { once: true },
    )
    document.body.appendChild(input)
    input.click()
  })
}
