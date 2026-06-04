/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Instrument Serif'", "serif"],
        body: ["Barlow", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "9999px",
      },
    },
  },
  plugins: [],
}
