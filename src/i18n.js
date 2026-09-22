import { useStore } from './store'

const zh = {
  appTitle: '方言對話',
  appSubtitle: '用你最熟悉嘅方言，同 AI 傾偈',
  history: '歷史對話',
  newChat: '＋ 新對話',
  emptyHistory: '未有對話',
  settings: '設定',
  close: '關閉',
  delete: '刪除',
  openHistory: '打開歷史',
  collapseSidebar: '收埋歷史',
  expandSidebar: '打開歷史',

  // toolbar
  language: '語言',
  fontSize: '字體大小',
  defaultDialect: '預設方言',
  apiReal: '真實 ASR',
  apiNoKey: '未設定 Key',
  apiMock: '示範模式',
  apiRealTitle: '已連接騰訊雲語音識別服務',
  apiNoKeyTitle: '後端已啟動，但尚未設定 .env 金鑰',
  apiMockTitle: '示範模式（後端未啟動）',
  themeDark: '深色模式',
  themeLight: '淺色模式',
  ownModelTitle: '自備 AI 模型',
  ownModelDesc: '無內建 AI。請填入你自己的 API Key（支援 DeepSeek、OpenAI、OpenRouter 等所有 OpenAI 兼容服務）。Key 只儲存在瀏覽器 localStorage，隨請求發送，不會存入伺服器。',
  apiKey: 'API Key',
  baseUrl: 'Base URL（可選）',
  modelName: '模型名稱',
  apiKeyPlaceholder: '貼上你的 API Key（如 DeepSeek: sk-xxx）',
  baseUrlPlaceholder: 'https://api.deepseek.com/v1 或留空用預設',
  modelPlaceholder: '例如 deepseek-chat、gpt-4o-mini',
  ownModelExamples: '範例：DeepSeek (https://api.deepseek.com/v1, deepseek-chat) · OpenRouter (https://openrouter.ai/api/v1) · OpenAI（預設）',

  // welcome / empty state
  welcomeTitle: '你好！同我傾偈啦',
  welcomeSubtitle: '撳下面粒大掣，用你嘅方言講嘢，AI 就識得聽同答你。',
  voiceGuideTitle: '由講嘢開始',
  voiceGuideBody: '撳藍色咪高峰開始講，講完再撳一次停低。文字會先顯示，等你確認後先傳送。',
  voiceGuideStepOne: '撳咪高峰',
  voiceGuideStepTwo: '用方言講嘢',
  voiceGuideStepThree: '確認後傳送',
  voiceAction: '撳咪高峰開始講嘢',
  suggestWeather: '今日天氣點呀？',
  suggestGreet: '你好嗎？',
  suggestThanks: '多謝你',

  // recording
  recording: '錄音中',
  recordingHint: '撳 ⏹ 停低',
  stop: '停低',
  cancel: '取消',
  listening: '聽緊你講嘢…',
  transcribing: '識別緊你講嘅嘢…',
  thinking: '諗緊…',

  // messages
  speak: '讀出',
  speaking: '讀緊…',
  userYou: '你',
  ai: '方言助手',

  // text input
  textInput: '文字輸入',
  typeHere: '撳呢度打字…',
  send: '傳送',

  // settings
  settingsTitle: '設定',
  languageSetting: '介面語言',
  fontSizeSetting: '字體大小',
  dialectSetting: '講邊種方言',
  clearHistory: '清除歷史對話',
  clearHistoryDesc: '刪除全部對話紀錄',
  clearHistoryConfirm: '確定要刪除所有對話紀錄？呢個動作冇得還原。',
  fontPreview: '住家飯最好食',
  saved: '已儲存',

  // fonts
  fontS: '細',
  fontM: '中',
  fontL: '大',
  fontXL: '特大',
  fontXXL: '超大',

  // confirm
  deleteConvConfirm: '確定要刪除呢個對話？',
  confirm: '確定',
  no: '唔好',

  // toasts / errors
  ttsPending: '語音合成，敬請期待',
  asrError: '聽唔清楚，可唔可以講多次？',
  micError: '開唔到咪高峰，請檢查權限設定',
  ttsError: '讀唔到聲，你可以睇返上面文字',
  chatError: '一時答唔到你，請再試一次',
}

const en = {
  appTitle: 'Dialect Dialogue',
  appSubtitle: 'Chat with AI in the dialect you know best',
  history: 'Chat history',
  newChat: '+ New chat',
  emptyHistory: 'No conversations yet',
  settings: 'Settings',
  close: 'Close',
  delete: 'Delete',
  openHistory: 'Open history',
  collapseSidebar: 'Collapse history',
  expandSidebar: 'Open history',

  language: 'Language',
  fontSize: 'Text size',
  defaultDialect: 'Default dialect',
  apiReal: 'Live ASR',
  apiNoKey: 'Keys missing',
  apiMock: 'Demo mode',
  apiRealTitle: 'Connected to Tencent Cloud speech recognition',
  apiNoKeyTitle: 'Backend is running, but .env keys are missing',
  apiMockTitle: 'Demo mode (backend is not running)',
  themeDark: 'Dark mode',
  themeLight: 'Light mode',
  ownModelTitle: 'Bring your own AI model',
  ownModelDesc: 'No built-in AI. Provide your own API key (supports DeepSeek, OpenAI, OpenRouter, or any OpenAI-compatible service). The key is stored only in your browser localStorage and sent with each request; it is never stored on the server.',
  apiKey: 'API Key',
  baseUrl: 'Base URL (optional)',
  modelName: 'Model name',
  apiKeyPlaceholder: 'Paste your API key (e.g. DeepSeek: sk-xxx)',
  baseUrlPlaceholder: 'https://api.deepseek.com/v1 or leave empty for default',
  modelPlaceholder: 'e.g. deepseek-chat, gpt-4o-mini',
  ownModelExamples: 'Examples: DeepSeek (https://api.deepseek.com/v1, deepseek-chat) · OpenRouter (https://openrouter.ai/api/v1) · OpenAI (default)',

  welcomeTitle: 'Hello! Let us chat',
  welcomeSubtitle: 'Press the big button below and speak in your dialect — the AI will listen and reply.',
  voiceGuideTitle: 'Start by speaking',
  voiceGuideBody: 'Press the blue microphone to start. Press it again when you are done; review the words before sending.',
  voiceGuideStepOne: 'Press the microphone',
  voiceGuideStepTwo: 'Speak your dialect',
  voiceGuideStepThree: 'Review and send',
  voiceAction: 'Press the microphone to speak',
  suggestWeather: "How's the weather today?",
  suggestGreet: 'How are you?',
  suggestThanks: 'Thank you',

  recording: 'Recording',
  recordingHint: 'Tap ⏹ to stop',
  stop: 'Stop',
  cancel: 'Cancel',
  listening: 'Listening…',
  transcribing: 'Transcribing your words…',
  thinking: 'Thinking…',

  speak: 'Read aloud',
  speaking: 'Reading…',
  userYou: 'You',
  ai: 'Dialect Assistant',

  textInput: 'Type a message',
  typeHere: 'Tap here to type…',
  send: 'Send',

  settingsTitle: 'Settings',
  languageSetting: 'Interface language',
  fontSizeSetting: 'Text size',
  dialectSetting: 'Which dialect do you speak?',
  clearHistory: 'Clear chat history',
  clearHistoryDesc: 'Delete all conversations',
  clearHistoryConfirm: 'Delete all conversations? This cannot be undone.',
  fontPreview: 'The best food is home cooking',
  saved: 'Saved',

  fontS: 'S',
  fontM: 'M',
  fontL: 'L',
  fontXL: 'XL',
  fontXXL: 'XXL',

  deleteConvConfirm: 'Delete this conversation?',
  confirm: 'Confirm',
  no: 'No',

  ttsPending: 'Voice synthesis is coming soon',
  asrError: "Sorry, I couldn't hear that clearly. Could you say it again?",
  micError: 'Could not access the microphone. Please check your permissions',
  ttsError: "I couldn't read it aloud — please read the text above",
  chatError: "I'm having trouble replying. Please try again",
}

export function useI18n() {
  const language = useStore((s) => s.language)
  const dict = language === 'en' ? en : zh
  return {
    t: (key) => dict[key] ?? zh[key] ?? key,
    language,
  }
}
