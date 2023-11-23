import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

export default {
  content: ["./src/views/**/*.njk"],
  theme: {
    extend: {},
  },
  plugins: [forms],
} satisfies Config;
