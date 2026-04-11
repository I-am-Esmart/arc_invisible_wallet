function normalizeUserKey(user) {
  const email = String(user?.email || "").trim().toLowerCase()
  const address = String(user?.address || "").trim().toLowerCase()
  return address || email || "guest"
}

export function getTxStorageKey(user) {
  return `txs:${normalizeUserKey(user)}`
}

export function getStoredTxsForUser(user) {
  try {
    return JSON.parse(localStorage.getItem(getTxStorageKey(user)) || "[]")
  } catch {
    return []
  }
}

export function addStoredTxForUser(user, txRecord) {
  const key = getTxStorageKey(user)
  const existing = getStoredTxsForUser(user)
  const deduped = [txRecord, ...existing].filter((tx, index, items) => {
    const currentHash = tx?.hash || `${tx?.from}-${tx?.to}-${tx?.timestamp}`
    return index === items.findIndex((candidate) => (
      (candidate?.hash || `${candidate?.from}-${candidate?.to}-${candidate?.timestamp}`) === currentHash
    ))
  })

  localStorage.setItem(key, JSON.stringify(deduped))
}
