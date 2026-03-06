/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        panel: "#0f0f18",
        border: "#1e1e2e",
        accent: "#00e5a0",
        text: "#e8e8f0",
        muted: "#6b6b8a",
      },
    },
  },
  plugins: [],
}
