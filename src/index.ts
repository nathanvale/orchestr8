import { serve } from "bun";

export function hello() {
  return "Hello world!";
}

serve({
  port: 3000,
  fetch(req) {
    return new Response("👋 Hello from Bun + Changesets + Commitizen template!", {
      headers: { "Content-Type": "text/plain" },
    });
  },
});

console.log("🚀 Server running at http://localhost:3000");
