import * as net from 'net';
import * as si from 'systeminformation';
import * as os from 'os';
import { WebSocketServer } from 'ws';
import * as fs from 'fs';
import * as path from 'path';

const CNS_SERVER_HOST = '127.0.0.1';
const CNS_SERVER_PORT = 3001;
const NODE_ID = `CNS-${os.hostname()}`;

let refreshIntervalMs = 5000;
let tcpClient = new net.Socket();
let intervalTimer: ReturnType<typeof setInterval>;

// =============================================
// CONFIGURACIÓN DE LOGS MEJORADA
// =============================================

// Crear directorio principal para logs de repositorios
const repositorioLogsDir = path.join(process.cwd(), 'repositorios_discos_Logs');
if (!fs.existsSync(repositorioLogsDir)) {
    fs.mkdirSync(repositorioLogsDir, { recursive: true });
    console.log('📁 Creado directorio principal:', repositorioLogsDir);
}

// Crear subdirectorio para este nodo específico
const nodeLogsDir = path.join(repositorioLogsDir, NODE_ID.replace(/[^a-zA-Z0-9_-]/g, '_'));
if (!fs.existsSync(nodeLogsDir)) {
    fs.mkdirSync(nodeLogsDir, { recursive: true });
    console.log(`📁 Creado directorio para nodo ${NODE_ID}:`, nodeLogsDir);
}

// Archivo para comandos del servidor
const comandosLogPath = path.join(nodeLogsDir, 'comandos_servidor.log');

// Archivo para reportes de métricas (con fecha para rotación diaria)
const getReportesLogPath = () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(nodeLogsDir, `reportes_${today}.log`);
};

// Función para escribir comandos del servidor
function writeComandoToLog(comando: string, detalles: string) {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] COMANDO: ${comando} | Detalles: ${detalles}\n`;
        fs.appendFileSync(comandosLogPath, logEntry);
        console.log('📝 Comando guardado en log:', comando);
    } catch (error) {
        console.error('❌ Error escribiendo comando al log:', error);
    }
}

// Función para escribir reportes de métricas
function writeReporteToLog(metrics: any) {
    try {
        const reportesLogPath = getReportesLogPath();
        const timestamp = new Date().toISOString();
        
        // Formatear la información del disco de manera legible
        const disk = metrics.disks[0];
        
        const logEntry = [
            `[${timestamp}] REPORTE DE MÉTRICAS`,
            `  Nodo ID: ${metrics.nodeId}`,
            `  Disco: ${disk.diskName}`,
            `  Tipo: ${disk.diskType}`,
            `  Capacidad Total: ${disk.diskSize} GB`,
            `  Espacio Usado: ${disk.diskUsedSpace} GB`,
            `  Espacio Libre: ${disk.diskFreeSpace} GB`,
            `  % Uso: ${((disk.diskUsedSpace / disk.diskSize) * 100).toFixed(2)}%`,
            `  IOPS: ${disk.diskIOPS}`,
            `  ${'-'.repeat(50)}\n`
        ].join('\n');
        
        fs.appendFileSync(reportesLogPath, logEntry);
        console.log('📊 Reporte guardado en log:', reportesLogPath);
    } catch (error) {
        console.error('❌ Error escribiendo reporte al log:', error);
    }
}

// Log de inicio del agente
const inicioLogPath = path.join(nodeLogsDir, 'inicio_agente.log');
fs.appendFileSync(inicioLogPath, `[${new Date().toISOString()}] AGENTE INICIADO\n`);
console.log('🚀 Agente iniciado, logs en:', nodeLogsDir);

// =============================================
// FIN CONFIGURACIÓN DE LOGS
// =============================================

async function getDiskMetrics() {
    const fsSize = await si.fsSize();
    const diskLayout = await si.diskLayout();

    const fs_ = fsSize[0];
    const disk = diskLayout[0] || { type: 'HDD' };
    
    const totalGB = fs_.size / (1024 ** 3);
    const usedGB = fs_.used / (1024 ** 3);

    const diskInfo = {
        diskName: fs_.fs,
        diskType: disk.type,
        diskSize: parseFloat(totalGB.toFixed(2)),
        diskUsedSpace: parseFloat(usedGB.toFixed(2)),
        diskFreeSpace: parseFloat((totalGB - usedGB).toFixed(2)),
        diskIOPS: disk.type === 'SSD' ? 5000 : 150
    };

    return { 
        nodeId: NODE_ID, 
        disks: [diskInfo]
    };
}

const wss = new WebSocketServer({ port: 4000 });
let reactClient: any = null;

wss.on('connection', (ws) => {
    console.log('🖥️ Interfaz React conectada al Agente Local');
    reactClient = ws;

    ws.on('message', (message) => {
        try {
            const cmd = JSON.parse(message.toString());
            if (cmd.type === 'CHANGE_INTERVAL') {
                refreshIntervalMs = cmd.value;
                restartReporting();
                console.log(`⏱️ Intervalo actualizado a ${refreshIntervalMs}ms desde la GUI`);
            }
        } catch (error) {
            console.error('Error procesando mensaje WebSocket:', error);
        }
    });

    ws.on('close', () => {
        console.log('🖥️ Interfaz React desconectada');
        reactClient = null;
    });
});

function connectToNestJS() {
    tcpClient = new net.Socket();

    tcpClient.on('error', (err) => {
        console.error('❌ Error de conexión con Servidor Central:', err.message);
    });

    tcpClient.connect(CNS_SERVER_PORT, CNS_SERVER_HOST, () => {
        console.log('✅ Conectado al Servidor Central NestJS');
        
        // Escribir en log cuando se conecta
        writeComandoToLog('CONEXION_ESTABLECIDA', `Conectado a ${CNS_SERVER_HOST}:${CNS_SERVER_PORT}`);
        
        restartReporting();
    });

    tcpClient.on('data', (data) => {
        try {
            const messageStr = data.toString();
            console.log('📨 Mensaje recibido del servidor:', messageStr);
            
            const payloadStart = messageStr.indexOf('#') + 1;
            if (payloadStart > 0) {
                const payloadStr = messageStr.substring(payloadStart);
                const payload = JSON.parse(payloadStr);
                
                if (payload.response) {
                    const serverCommand = payload.response.command || 'NO_COMMAND';
                    const serverStatus = payload.response.status || 'UNKNOWN';
                    
                    // Guardar en archivo de log de comandos
                    writeComandoToLog(
                        serverCommand, 
                        `Status=${serverStatus}, Timestamp=${payload.response.timestamp || 'N/A'}`
                    );
                    
                    // Enviar a la interfaz React si está conectada
                    if (reactClient) {
                        reactClient.send(JSON.stringify({ 
                            type: 'CNS_COMMAND', 
                            payload: payloadStr 
                        }));
                    }
                    
                    if (serverCommand === 'DISCONNECT') {
                        console.log('⚠️ El servidor nos ha desconectado. Cerrando...');
                        tcpClient.destroy();
                        process.exit(1);
                    }
                }
            }
        } catch (error) {
            console.error('Error procesando mensaje del servidor:', error);
        }
    });

    tcpClient.on('close', () => {
        console.log('🔌 Conexión perdida. Reintentando en 5s...');
        writeComandoToLog('CONEXION_PERDIDA', 'Reintentando en 5 segundos');
        clearInterval(intervalTimer);
        setTimeout(connectToNestJS, 5000);
    });
}

function restartReporting() {
    if (intervalTimer) clearInterval(intervalTimer);
    
    intervalTimer = setInterval(async () => {
        try {
            const metrics = await getDiskMetrics();
            
            // GUARDAR EL REPORTE EN EL LOG ANTES DE ENVIARLO
            writeReporteToLog(metrics);
            
            const payload = JSON.stringify({ pattern: 'report_metrics', data: metrics });
            tcpClient.write(`${payload.length}#${payload}`);

            if (reactClient) {
                reactClient.send(JSON.stringify({ type: 'METRICS_UPDATE', payload: metrics }));
            }
        } catch (error) {
            console.error('Error enviando métricas:', error);
        }
    }, refreshIntervalMs);
    
    console.log(`📊 Reporte de métricas iniciado con intervalo de ${refreshIntervalMs}ms`);
    writeComandoToLog('REPORTE_INICIADO', `Intervalo: ${refreshIntervalMs}ms`);
}

// Iniciar conexión
connectToNestJS();

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando cliente...');
    writeComandoToLog('AGENTE_CERRADO', 'Terminación graceful por SIGINT');
    clearInterval(intervalTimer);
    tcpClient.destroy();
    wss.close();
    process.exit();
});

process.on('SIGTERM', () => {
    console.log('\n👋 Cerrando cliente por SIGTERM...');
    writeComandoToLog('AGENTE_CERRADO', 'Terminación por SIGTERM');
    clearInterval(intervalTimer);
    tcpClient.destroy();
    wss.close();
    process.exit();
});