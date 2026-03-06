// server.ts
const PORT = process.env.PORT || 3000;

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        // Rspack por defecto genera todo en la carpeta 'dist'
        const file = Bun.file(`./dist${path === '/' ? '/index.html' : path}`);

        if (await file.exists()) {
            return new Response(file);
        }

        // Soporte para Single Page Application (React Router)
        return new Response(Bun.file("./dist/index.html"));
    },
});

console.log(`🌐 Monitor Nacional UI online en puerto ${PORT}`);