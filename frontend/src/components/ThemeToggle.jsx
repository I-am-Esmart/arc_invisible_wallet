import { useEffect, useState } from "react"

const STORAGE_KEY = "arc-wallet-theme"

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light")

  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEY)
    const nextTheme = savedTheme === "dark" ? "dark" : "light"
    setTheme(nextTheme)
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
  }, [])

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
    localStorage.setItem(STORAGE_KEY, nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-4 top-4 z-50 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  )
}
