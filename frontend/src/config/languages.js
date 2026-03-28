export const LANGUAGES = [
  { value: 'en', label: 'English',    flag: '🇺🇸' },
  { value: 'ta', label: 'Tamil',      flag: '🇮🇳' },
  { value: 'hi', label: 'Hindi',      flag: '🇮🇳' },
  { value: 'es', label: 'Spanish',    flag: '🇪🇸' },
  { value: 'fr', label: 'French',     flag: '🇫🇷' },
  { value: 'de', label: 'German',     flag: '🇩🇪' },
  { value: 'zh', label: 'Chinese',    flag: '🇨🇳' },
  { value: 'ja', label: 'Japanese',   flag: '🇯🇵' },
  { value: 'ar', label: 'Arabic',     flag: '🇸🇦' },
  { value: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { value: 'ru', label: 'Russian',    flag: '🇷🇺' },
]

export const getLang = (value) => LANGUAGES.find(l => l.value === value) || LANGUAGES[0]
