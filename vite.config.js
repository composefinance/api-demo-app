import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the build works under any path, including the
  // GitHub Pages project subpath (https://<org>.github.io/api-demo-app/).
  base: "./",
  plugins: [react()],
});
