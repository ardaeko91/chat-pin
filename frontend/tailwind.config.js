/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          dark: '#111b21',
          panel: '#202c33',
          chat: '#0b141a',
          incoming: '#202c33',
          outgoing: '#005c4b',
          accent: '#00a884',
          green: '#25d366',
          text: '#e9edef',
          muted: '#8696a0',
          border: '#374248',
        }
      }
    },
  },
  plugins: [],
}
