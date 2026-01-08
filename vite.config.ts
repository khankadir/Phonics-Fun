
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Define process.env to prevent ReferenceError: process is not defined in browser
    'process.env': {}
  }
});
