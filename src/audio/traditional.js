// Normalize ASR output to Hong Kong Traditional Chinese.
// Tencent's Mandarin engines return Simplified Chinese; for an elderly Hong Kong
// audience the whole app should stay in Traditional Chinese, so we convert here.
import { Converter } from 'opencc-js'

let converter = null

function getConverter() {
  if (!converter) converter = Converter({ from: 'cn', to: 'hk' })
  return converter
}

export function toTraditional(text) {
  if (!text) return text
  try {
    return getConverter()(text)
  } catch {
    return text
  }
}
