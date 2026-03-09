import * as net from 'net';
import * as si from 'systeminformation';
import * as os from 'os';
import { WebSocketServer } from 'ws';
import * as fs from 'fs';
import * as path from 'path';

// Cambia esto según tu entorno
const CNS_SERVER_HOST = 'gondola.proxy.rlwy.net';
const CNS_SERVER_PORT = 56212; // Asegúrate de que este es el puerto TCP de NestJS
const NODE_ID = `CNS-${os.hostname()}`;

let refreshIntervalMs = 5000;
let tcpClient: net.Socket;
let intervalTimer: ReturnType<typeof setTimeout>;
let tcpBuffer = ''; // ACUMULADOR PARA DATOS FRAGMENTADOS

// =============================================
// LOGS Y MÉTRICAS (Sin cambios significativos)
// =============================================

const nodeLogsDir = path.join(process.cwd(), 'repositorios_discos_Logs', NODE_ID.replace(/[^a-zA-Z0-9_-]/g, '_'));
if (!fs.existsSync(nodeLogsDir)) fs.mkdirSync(nodeLogsDir, { recursive: true });

function writeComandoToLog(comando: string, detalles: string) {
    const logEntry = `[${new Date().toISOString()}] COMANDO: ${comando} | ${detalles}\n`;
    fs.appendFileSync(path.join(nodeLogsDir, 'comandos_servidor.log'), logEntry);
}

async function getDiskMetrics() {
    const fsSize = await si.fsSize();
    const diskLayout = await si.diskLayout();
    const fs_ = fsSize[0];
    const disk = diskLayout[0] || { type: 'HDD' };
    const totalGB = fs_.size / (1024 ** 3);
    const usedGB = fs_.used / (1024 ** 3);

    return {
        nodeId: NODE_ID,
        disks: [{
            diskName: fs_.fs,
            diskType: disk.type,
            diskSize: parseFloat(totalGB.toFixed(2)),
            diskUsedSpace: parseFloat(usedGB.toFixed(2)),
            diskFreeSpace: parseFloat((totalGB - usedGB).toFixed(2)),
            diskIOPS: disk.type === 'SSD' ? 5000 : 150,
        }],
        clientTimestamp: new Date().toISOString()
    };
}

// =============================================
// COMUNICACIÓN TCP CORREGIDA
// =============================================

function connectToNestJS() {
    if (tcpClient) tcpClient.destroy();

    tcpClient = new net.Socket();
    tcpBuffer = ''; // Resetear buffer

    tcpClient.on('error', (err) => {
        console.error('❌ Error de conexión:', err.message);
    });

    tcpClient.connect(CNS_SERVER_PORT, CNS_SERVER_HOST, () => {
        console.log('✅ Conectado al Servidor Central NestJS');
        writeComandoToLog('CONEXION_ESTABLECIDA', `Host: ${CNS_SERVER_HOST}`);
        startReporting();
    });

    tcpClient.on('data', (data) => {
        tcpBuffer += data.toString('utf8');

        while (tcpBuffer.includes('#')) {
            const hashIndex = tcpBuffer.indexOf('#');
            const lengthStr = tcpBuffer.substring(0, hashIndex);
            const expectedLength = parseInt(lengthStr, 10);

            if (isNaN(expectedLength)) {
                tcpBuffer = '';
                break;
            }

            const messageStart = hashIndex + 1;
            if (tcpBuffer.length >= messageStart + expectedLength) {
                const messageStr = tcpBuffer.substring(messageStart, messageStart + expectedLength);
                tcpBuffer = tcpBuffer.substring(messageStart + expectedLength);

                try {
                    const payload = JSON.parse(messageStr);

                    if (payload.err) {
                        console.error('🚨 Error de NestJS:', payload.err);
                        return;
                    }

                    // VALIDACIÓN DE RESPUESTA ANIDADA (Estructura de NestJS)
                    if (payload.response) {
                        // Extraemos la data real. NestJS suele enviar { response: { response: { command, status ... } } }
                        const innerResponse = payload.response.response || payload.response;

                        const serverCommand = innerResponse.command || 'ACK_RECEIVED';
                        const serverStatus = innerResponse.status || 'OK';
                        const serverTime = innerResponse.timestamp || new Date().toISOString();

                        console.log(`📥 Servidor: [${serverCommand}] | Status: ${serverStatus}`);

                        // Guardamos en el log con los detalles completos
                        writeComandoToLog(serverCommand, `Status=${serverStatus}, ServerTime=${serverTime}`);

                        // Notificamos a React con el comando limpio
                        if (reactClient) {
                            reactClient.send(JSON.stringify({
                                type: 'CNS_COMMAND',
                                payload: serverCommand
                            }));
                        }

                        // RESPUESTA DE CONFIRMACIÓN (ACK)
                        // Enviamos el patrón que tu servidor espera recibir
                        setImmediate(() => {
                            if (!tcpClient.destroyed && tcpClient.writable) {
                                const ackObj = {
                                    pattern: 'client_ack',
                                    data: {
                                        nodeId: NODE_ID,
                                        status: 'ACK_OK',
                                        receivedCommand: serverCommand
                                    }
                                };
                                const ackPayload = JSON.stringify(ackObj);
                                tcpClient.write(`${Buffer.byteLength(ackPayload, 'utf8')}#${ackPayload}`);
                            }
                        });

                        if (serverCommand === 'DISCONNECT') {
                            console.warn('⚠️ Desconexión ordenada por el servidor.');
                            tcpClient.destroy();
                        }
                    }
                } catch (error) {
                    console.error('❌ Error procesando el paquete:', error);
                }
            } else break;
        }
    });
    tcpClient.on('close', () => {
        console.log('🔌 Conexión perdida. Reintentando en 5s...');
        if (intervalTimer) clearTimeout(intervalTimer);
        setTimeout(connectToNestJS, 5000);
    });
}

function handleServerResponse(payload: any) {
    // NestJS a veces envuelve la respuesta en "response"
    const responseData = payload.response?.response || payload.response || payload;
    const command = responseData.command || 'ACK';

    console.log(`📥 Respuesta Servidor: ${command}`);
    writeComandoToLog(command, JSON.stringify(responseData));

    // Enviar ACK si es necesario (sin bloquear el flujo)
    setImmediate(() => {
        if (!tcpClient.destroyed) {
            const ack = JSON.stringify({ pattern: 'client_ack', data: { nodeId: NODE_ID, status: 'OK', timestamp: new Date().toISOString() } });
            const ackLength = Buffer.byteLength(ack, 'utf8');
            tcpClient.write(`${ackLength}#${ack}`);
        }
    });

    if (command === 'DISCONNECT') {
        tcpClient.destroy();
        process.exit(0);
    }
}

function startReporting() {
    if (intervalTimer) clearTimeout(intervalTimer);

    const sendReport = async () => {
        if (tcpClient.destroyed) return;

        try {
            const metrics = await getDiskMetrics();
            const messageObj = {
                pattern: 'report_metrics',
                data: metrics,
                id: Date.now().toString()
            };

            const payload = JSON.stringify(messageObj);
            // 3. CONTEO POR BYTES (Vital para estabilidad)
            const byteLength = Buffer.byteLength(payload, 'utf8');

            tcpClient.write(`${byteLength}#${payload}`);
            console.log(`📤 Reporte enviado (${byteLength} bytes)`);

            if (reactClient) {
                reactClient.send(JSON.stringify({ type: 'METRICS_UPDATE', payload: metrics }));
            }
        } catch (error) {
            console.error('❌ Error en reporte:', error);
        }

        // Programar siguiente envío (recursivo es más estable que setInterval)
        intervalTimer = setTimeout(sendReport, refreshIntervalMs);
    };

    sendReport();
}

// =============================================
// WEBSOCKET Y CIERRE
// =============================================

const wss = new WebSocketServer({ port: 4000 });
let reactClient: any = null;

wss.on('connection', (ws) => {
    reactClient = ws;
    ws.on('message', (msg) => {
        const cmd = JSON.parse(msg.toString());
        if (cmd.type === 'CHANGE_INTERVAL') {
            refreshIntervalMs = cmd.value;
            console.log(`⏱️ Intervalo: ${refreshIntervalMs}ms`);
            startReporting();
        }
    });
});

connectToNestJS();

const cleanExit = () => {
    console.log('\n👋 Cerrando...');
    if (intervalTimer) clearTimeout(intervalTimer);
    tcpClient.destroy();
    wss.close();
    process.exit();
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);