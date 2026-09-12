/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agent: {
          peach: "#FAD2C0",
          peachLight: "#FFE6DC",
          cream: "#FFF9F5",
          bg: "#FDF8F5",
          sage: "#A8BFA3",
          sageDark: "#55705C",
          text: "#343434",
          muted: "#737373",
          border: "#E9D8CC",
          success: "#3E8C5A",
          successBg: "#E8F5E9",
          blocked: "#C94C4C",
          blockedBg: "#FFEBEE",
          blue: "#3B82F6",
          blueLight: "#E3F2FD",
          cardBorder: "#F0E2D8",
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(52, 52, 52, 0.04), 0 2px 6px -1px rgba(52, 52, 52, 0.02)',
        'card': '0 2px 12px 0 rgba(240, 226, 216, 0.4)',
        'glow': '0 0 20px rgba(250, 210, 192, 0.5)',
      }
    },
  },
  plugins: [],
}
