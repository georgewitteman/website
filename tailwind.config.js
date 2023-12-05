module.exports = {
  content: ["./templates/**/*", "./static/**/*"],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ]
};
