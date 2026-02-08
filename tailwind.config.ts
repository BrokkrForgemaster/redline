import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
     
        redline: "#B11226",  
        lawn: "#2F6F3E",     
        ice: "#E6F2F7",     

        offwhite: "#F9F9F9", 
        charcoal: "#1F1F1F", 
        muted: "#6B7280",     
        border: "#E5E7EB",    
      },
    },
  },
  plugins: [],
};

export default config;
