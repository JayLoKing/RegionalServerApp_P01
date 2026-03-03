// dev.ts
console.log("🚀 Iniciando entorno de desarrollo híbrido...");

// Lanzar el Agente (Bun)
const agent = Bun.spawn(["bun", "--watch", "agent/local-agent.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});

// Lanzar la UI (Rspack)
const ui = Bun.spawn(["bun", "run", "dev:ui"], {
  stdout: "inherit",
  stderr: "inherit",
});

// Manejar el cierre de procesos (Ctrl + C)
process.on("SIGINT", () => {
  console.log("\nStopping services...");
  agent.kill();
  ui.kill();
  process.exit();
});