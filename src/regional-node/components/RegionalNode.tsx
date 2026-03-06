import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const RegionalNode = () => {
    const [metrics, setMetrics] = useState<any>(null);
    const [cnsCommand, setCnsCommand] = useState<string>('');
    const [intervalValue, setIntervalValue] = useState(5000);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Estados de conexión
    const [localConnected, setLocalConnected] = useState(false);
    const [cloudConnected, setCloudConnected] = useState(false);

    const localWsRef = useRef<WebSocket | null>(null);
    const cloudSocketRef = useRef<Socket | null>(null);
    const identifiedNodeId = useRef<string | null>(null);

    // Ajusta estas URLs según tu entorno de Railway
    const CLOUD_URL = 'https://mainserverappp01-production.up.railway.app';
    const LOCAL_WS_URL = 'ws://127.0.0.1:4000';

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // --- 1. CONEXIÓN CLOUD (Socket.io) ---
        const cloudSocket = io(CLOUD_URL, {
            transports: ['websocket'],
            reconnection: true
        });
        cloudSocketRef.current = cloudSocket;

        cloudSocket.on('connect', () => setCloudConnected(true));
        cloudSocket.on('disconnect', () => setCloudConnected(false));

        // CANAL DE DESCUBRIMIENTO: Escuchamos quién está reportando
        cloudSocket.on('discovery_ping', (data) => {
            // Si el dashboard no tiene ID aún, adoptamos el primero que llegue
            if (!identifiedNodeId.current && data.nodeId) {
                console.log("🚀 Nodo descubierto automáticamente:", data.nodeId);
                subscribeToPrivateChannel(data.nodeId);
            }
        });

        const subscribeToPrivateChannel = (nodeId: string) => {
            identifiedNodeId.current = nodeId;
            // Escuchamos el canal privado que creamos en el Gateway
            cloudSocket.on(`metrics_update_${nodeId}`, (data) => {
                setMetrics(data);
            });
            // Escuchamos comandos privados
            cloudSocket.on(`command_${nodeId}`, (cmd) => {
                handleCommand(cmd);
            });
        };

        // --- 2. CONEXIÓN LOCAL (Prioridad) ---
        const connectLocal = () => {
            const ws = new WebSocket(LOCAL_WS_URL);

            ws.onopen = () => {
                setLocalConnected(true);
                console.log("✅ Conectado al Agente Local");
            };

            ws.onclose = () => {
                setLocalConnected(false);
                setTimeout(connectLocal, 5000);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'METRICS_UPDATE') {
                    // Si el local conecta, forzamos la suscripción cloud con ese ID
                    if (!identifiedNodeId.current) {
                        subscribeToPrivateChannel(data.payload.nodeId);
                    }
                    setMetrics(data.payload);
                }
                if (data.type === 'CNS_COMMAND') handleCommand(data.payload);
            };
            localWsRef.current = ws;
        };

        connectLocal();

        return () => {
            localWsRef.current?.close();
            cloudSocket.disconnect();
        };
    }, []);

    const handleCommand = (payload: any) => {
        try {
            let cmd = typeof payload === 'string' && payload.startsWith('"') ? JSON.parse(payload) : payload;
            const cmdString = String(cmd);
            if (cmdString === 'ACK' || cmdString === 'NONE') setCnsCommand('');
            else setCnsCommand(cmdString);
        } catch (e) { setCnsCommand(String(payload)); }
    };

    const handleIntervalChange = () => {
        if (localWsRef.current?.readyState === WebSocket.OPEN) {
            localWsRef.current.send(JSON.stringify({ type: 'CHANGE_INTERVAL', value: intervalValue }));
            showToast();
        }
    };

    const showToast = () => {
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center space-x-3 animate-slide-in';
        toast.innerHTML = `<span>⚡</span><div><p class="font-semibold">Intervalo actualizado</p><p class="text-sm opacity-90">${intervalValue}ms</p></div>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    if (!metrics) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
                <div className="text-center relative">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-white/20 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-24 h-24 border-4 border-transparent border-t-white border-r-white rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-lg rounded-full flex items-center justify-center">
                                <span className="text-3xl animate-pulse">🌐</span>
                            </div>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mt-8 mb-2">Conectando al Nodo Regional</h2>
                    <p className="text-white/60">Sincronizando con Railway y Agente Local...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 font-sans selection:bg-purple-500/30">
            {/* Fondo con Efecto Blob Original */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            </div>

            <div className="relative max-w-7xl mx-auto p-6 space-y-6">
                {/* Header Glassmorphism con Indicadores de Red */}
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl p-6 border border-white/20">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-3xl filter drop-shadow-lg">🌐</span>
                                </div>
                                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${localConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">Nodo Regional</h1>
                                <div className="flex items-center space-x-2 text-white/60 text-sm">
                                    <span>ID: {metrics.nodeId}</span>
                                    <span>•</span>
                                    <span>{currentTime.toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Status de Red Híbrida */}
                        <div className="flex gap-2">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${localConnected ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                                LOCAL: {localConnected ? 'ON' : 'OFF'}
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${cloudConnected ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                                CLOUD: {cloudConnected ? 'READY' : 'WAIT'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerta CNS Animada */}
                {cnsCommand && (
                    <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-2xl p-4 animate-slide-in">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center">
                                <span className="text-2xl animate-pulse">⚠️</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-red-200 text-xs font-bold uppercase tracking-widest">Alerta de Servidor Central</p>
                                <p className="text-white text-lg font-semibold">{cnsCommand}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Control Panel Glassmorphism */}
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl p-6 border border-white/20">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                                <span>⚙️</span>
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">Auto-Refresh</h3>
                                <p className="text-white/40 text-xs text-nowrap">Control de Agente Local</p>
                            </div>
                        </div>
                        <div className="flex-1 flex w-full gap-3">
                            <input
                                type="number"
                                value={intervalValue}
                                onChange={(e) => setIntervalValue(Number(e.target.value))}
                                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-purple-500/50 transition"
                                placeholder="ms"
                            />
                            <button
                                onClick={handleIntervalChange}
                                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:scale-105 transition-transform text-white font-bold rounded-xl shadow-lg"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid de Discos con Estilos Originales */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {metrics.disks.map((disk: any, i: number) => {
                        const usage = (disk.diskUsedSpace / disk.diskSize) * 100;
                        const isCritical = usage >= 90;
                        const isWarning = usage >= 75 && usage < 90;

                        return (
                            <div key={i} className="group relative backdrop-blur-xl bg-white/10 rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden transition-all duration-500 hover:scale-[1.02]">
                                <div className={`h-2 w-full ${isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                                                <span className="text-2xl">💿</span>
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold text-lg">{disk.diskName}</h3>
                                                <p className="text-white/40 text-xs uppercase tracking-tighter">{disk.diskType}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mb-6">
                                        {[
                                            { l: 'Total', v: disk.diskSize },
                                            { l: 'Uso', v: disk.diskUsedSpace },
                                            { l: 'Libre', v: disk.diskFreeSpace }
                                        ].map((m, idx) => (
                                            <div key={idx} className="bg-white/5 rounded-2xl p-2 border border-white/5 text-center">
                                                <p className="text-[10px] text-white/40 uppercase">{m.l}</p>
                                                <p className="text-white font-bold text-sm">{m.v}G</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-white/60">
                                            <span>Capacidad</span>
                                            <span className={isCritical ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-green-400'}>
                                                {usage.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                            <div
                                                className={`h-full transition-all duration-1000 ${isCritical ? 'bg-gradient-to-r from-red-500 to-pink-500' : isWarning ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}
                                                style={{ width: `${usage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};