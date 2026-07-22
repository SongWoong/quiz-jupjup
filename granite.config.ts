import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "quiz-jupjup",
  brand: {
    displayName: "오늘의 퀴즈정답",
    primaryColor: "#3182f6",
    icon: "https://static.toss.im/appsintoss/36953/0260bee8-7f9a-4b3b-afec-bd63dcbfe00f.png",
  },
  web: {
    host: "localhost",
    port: 5177,
    commands: {
      dev: "vite dev --port 5177",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
