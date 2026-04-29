export interface TeamTheme {
  primaryColor: string
  secondaryColor: string
  teamName: string
  logoUrl: string | null
}

export const DEFAULT_THEME: TeamTheme = {
  primaryColor: '#c4822a',
  secondaryColor: '#f5edd6',
  teamName: '',
  logoUrl: null,
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '196, 130, 42'
}

export function applyTeamTheme(theme: TeamTheme) {
  document.documentElement.style.setProperty('--primary', theme.primaryColor)
  document.documentElement.style.setProperty('--secondary', theme.secondaryColor)
  document.documentElement.style.setProperty('--primary-rgb', hexToRgb(theme.primaryColor))
}

export function resetTeamTheme() {
  document.documentElement.style.setProperty('--primary', DEFAULT_THEME.primaryColor)
  document.documentElement.style.setProperty('--secondary', DEFAULT_THEME.secondaryColor)
  document.documentElement.style.setProperty('--primary-rgb', hexToRgb(DEFAULT_THEME.primaryColor))
}
