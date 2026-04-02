export const DEFAULT_TOKEN = "USDC"

export const TOKEN_OPTIONS = [
  { value: "USDC", label: "USDC" },
  { value: "EURC", label: "EURC" },
]

export function normalizeToken(token) {
  const upperToken = token?.toUpperCase()
  return TOKEN_OPTIONS.some((option) => option.value === upperToken)
    ? upperToken
    : DEFAULT_TOKEN
}
