// ─────────────────────────────────────────────────────────────────────────────
// LLM client — OpenAI-compatible API only (no built-in LM Studio)
// Users provide their own API key (DeepSeek, OpenAI, OpenRouter, etc.) in Settings
// ─────────────────────────────────────────────────────────────────────────────

const DIALECT_PROMPTS = {
  cantonese:
    '請用粵語（廣東話）直接畀最終答案，口語化、親切有禮，適合老人家聽。長度中等',
  hakka:
    '你係「方言助手」。請用客家話直接畀最終答案，口語化、親切有禮，適合老人家聽。回覆簡短，幾句就夠，唔好講解過程。',
  teochew:
    '你係「方言助手」。請用潮汕話直接畀最終答案，口語化、親切有禮，適合老人家聽。回覆簡短，幾句就夠，唔好講解過程。',
  hokkien:
    '你係「方言助手」。請用閩南語（福建話）直接畀最終答案，口語化、親切有禮，適合老人家聽。回覆簡短，幾句就夠，唔好講解過程。',
  mandarin:
    '你是「方言助手」。请直接用普通话给出最终答案，口语化、亲切有礼，适合老人家听。回复简短，几句就好，不要解释过程。',
}

export function dialectSystemPrompt(dialect) {
  return DIALECT_PROMPTS[dialect] || DIALECT_PROMPTS.mandarin
}

export async function lmChat({
  systemPrompt,
  history = [],
  temperature = 0.7,
  maxTokens = 2048,
  timeoutMs = 120000,
  apiKey,
  baseUrl,
  model,
}) {
  if (!apiKey) {
    throw new Error('No API key provided. Please set your API key in Settings.')
  }
  const effBase = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const effModel = model || 'gpt-4o-mini'
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push(...history)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }

  const res = await fetch(`${effBase}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: effModel, messages, temperature, max_tokens: maxTokens, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('LLM returned no content')
  return content
}