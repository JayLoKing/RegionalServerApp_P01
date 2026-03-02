import * as net from 'net';
import * as si from 'systeminformation';
import * as os from 'os';
import { WebSocketServer } from 'ws';

const CNS_SERVER_HOST = 'turntable.proxy.rlwy.net';
const CNS_SERVER_PORT = 26080;
const NODE_ID = `CNS-${os.hostname()}$`;

let refreshIntervalMs = 5000;
let tcpClient = new net.Socket();
let intervalTimer: ReturnType<typeof setInterval>;

async function getDiskMetrics() {
    const fsSize = await si.fsSize();
    const diskLayout = await si.diskLayout();

    const disks = fsSize.map((fs, index) => {
        const totalGB = fs.size / (1024 ** 3);
        const usedGB = fs.used / (1024 ** 3);
        const diskType = diskLayout[index] ? diskLayout[index].type : 'HDD';

        return {
            diskName: fs.fs,
            diskType: diskType,
            diskSize: parseFloat(totalGB.toFixed(2)),
            diskUsedSpace: parseFloat(usedGB.toFixed(2)),
            diskFreeSpace: parseFloat((totalGB - usedGB).toFixed(2)),
            diskIOPS: diskType === 'SSD' ? 5000 : 150
        };
    });

    return { nodeId: NODE_ID, disks };
}




const wss = new WebSocketServer({ port: 4000 });
let reactClient: any = null;

wss.on('connection', (ws) => {
    console.log('🖥️ Interfaz React conectada al Agente Local');
    reactClient = ws;

    ws.on('message', (message) => {
        const cmd = JSON.parse(message.toString());
        if (cmd.type === 'CHANGE_INTERVAL') {
            refreshIntervalMs = cmd.value;
            restartReporting();
            console.log(`⏱️ Intervalo actualizado a ${refreshIntervalMs}ms desde la GUI`);
        }
    });
});

function connectToNestJS() {
    // Añade este listener para que el script no se detenga por errores de red
    tcpClient.on('error', (err) => {
        console.error('❌ Error de conexión con Railway:', err.message);
    });

    tcpClient.connect(CNS_SERVER_PORT, CNS_SERVER_HOST, () => {
        console.log('✅ Conectado al Servidor Central NestJS');
        restartReporting();
    });

    tcpClient.on('close', () => {
        console.log('🔌 Conexión perdida. Reintentando en 5s...');
        setTimeout(connectToNestJS, 5000);
    });
}

function restartReporting() {
    clearInterval(intervalTimer);
    intervalTimer = setInterval(async () => {
        const metrics = await getDiskMetrics();

        const payload = JSON.stringify({ pattern: 'report_metrics', data: metrics });
        tcpClient.write(`${payload.length}#${payload}`);

        if (reactClient) reactClient.send(JSON.stringify({ type: 'METRICS_UPDATE', payload: metrics }));

    }, refreshIntervalMs);
}

connectToNestJS();