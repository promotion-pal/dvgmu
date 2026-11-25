import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Storybook (react-vite) подхватывает этот конфиг автоматически.
// Алиасы дублируют `paths` из tsconfig.json — заглушки для монорепо-импортов.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@api/enum/analytic.enum_pb": local("./_local/analytic.proto.ts"),
      "@api/entity/analytic.entity_pb": local("./_local/analytic.proto.ts"),
      "@/shared/models/analytic": local("./_local/analytic.model.ts"),
    },
  },
});
