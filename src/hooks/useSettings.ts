import { useState, useCallback, useEffect } from 'react'
import type { Settings } from '@/types'

const STORAGE_KEY = 'sourcekit_settings'

const DEFAULT_SETTINGS: Settings = {
  enrichment_api_url: '',
  slack_webhook_url: '',
  target_company: '',
  role_title: '',
  one_line_pitch: '',
  auto_enrich_github: true,
  github_token: '',
}

function loadSettings(): Settings {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setSaveError(false)
    } catch (err) {
      console.error('Failed to save settings to localStorage:', err)
      setSaveError(true)
    }
  }, [settings])

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return { settings, updateSettings, resetSettings, saveError }
}
