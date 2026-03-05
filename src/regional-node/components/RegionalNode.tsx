import { useEffect, useState } from 'react';

export const RegionalNode = () => {
    const [metrics, setMetrics] = useState<any>(null);
    const [cnsCommand, setCnsCommand] = useState<string>('');
    const [intervalValue, setIntervalValue] = useState(5000);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const localWs = new WebSocket('ws://localhost:4000');

        localWs.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'METRICS_UPDATE') {
                setMetrics(data.payload);
            }

            if (data.type === 'CNS_COMMAND') {
                try {
                    // Limpiamos el payload por si viene con comillas extra
                    let rawCommand = data.payload;
                    if (typeof rawCommand === 'string' && rawCommand.startsWith('"') && rawCommand.endsWith('"')) {
                        rawCommand = JSON.parse(rawCommand);
                    }

                    const commandString = String(rawCommand);
                    console.log("Comando recibido en React:", commandString);

                    // Si el servidor dice que todo está bien (ACK o NONE), ocultamos la alerta
                    if (commandString === 'ACK' || commandString === 'NONE') {
                        setCnsCommand(''); // Limpiamos el estado
                    } else {
                        // Si es una alerta real (WARNING o ERROR), la mostramos
                        setCnsCommand(commandString);
                    }
                } catch (e) {
                    setCnsCommand(String(data.payload));
                }
            }
        };

        setWs(localWs);
        return () => localWs.close();
    }, []);

    const handleIntervalChange = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'CHANGE_INTERVAL', value: intervalValue }));

            // Toast personalizado
            const toast = document.createElement('div');
            toast.className = 'fixed top-4 right-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center space-x-3 animate-slide-in';
            toast.innerHTML = `
                <span class="text-2xl">⚡</span>
                <div>
                    <p class="font-semibold">Intervalo actualizado</p>
                    <p class="text-sm opacity-90">${intervalValue}ms · Auto-refresh configurado</p>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'slide-out 0.3s ease-out forwards';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    };

    if (!metrics) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
                <div className="text-center relative">
                    {/* Anillo de carga animado */}
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
                    <p className="text-white/60">Estableciendo canal seguro de comunicación...</p>

                    {/* Barras de progreso decorativas */}
                    <div className="flex gap-1 justify-center mt-8">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 h-8 bg-white/20 rounded-full overflow-hidden"
                            >
                                <div
                                    className="w-full bg-gradient-to-t from-white to-white/60 rounded-full animate-pulse"
                                    style={{
                                        height: `${Math.random() * 100}%`,
                                        animationDelay: `${i * 0.1}s`,
                                        animationDuration: '1s'
                                    }}
                                ></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Fondo con efecto de partículas */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative max-w-7xl mx-auto p-6 space-y-6">
                {/* Header Glassmorphism */}
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl p-6 border border-white/20">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-3xl filter drop-shadow-lg">🌐</span>
                                </div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
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

                        {/* Estadísticas rápidas */}
                        <div className="flex gap-3">
                            <div className="backdrop-blur-lg bg-white/5 rounded-xl px-4 py-2 border border-white/10">
                                <p className="text-white/40 text-xs">DISCOS</p>
                                <p className="text-white text-xl font-bold">{metrics.disks.length}</p>
                            </div>
                            <div className="backdrop-blur-lg bg-white/5 rounded-xl px-4 py-2 border border-white/10">
                                <p className="text-white/40 text-xs">ESTADO</p>
                                <p className="text-green-400 text-xl font-bold">ACTIVO</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerta CNS */}
                {/* Si cnsCommand tiene texto (es decir, no está vacío) mostramos la alerta */}
                {cnsCommand && (
                    <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-2xl p-4 animate-slide-in">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center backdrop-blur-lg">
                                <span className="text-2xl animate-pulse">⚠️</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-red-200 text-sm font-medium">ALERTA DEL SERVIDOR CENTRAL</p>
                                <p className="text-white text-lg font-semibold">{cnsCommand}</p>
                            </div>
                            <div className="text-red-200 text-sm bg-red-500/30 px-3 py-1 rounded-full animate-pulse">
                                URGENTE
                            </div>
                        </div>
                    </div>
                )}

                {/* Control Panel */}
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl p-6 border border-white/20">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                                <span className="text-xl">⚙️</span>
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">Auto-Refresh</h3>
                                <p className="text-white/40 text-sm">Configura el intervalo de actualización</p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-wrap gap-3">
                            <div className="flex-1 relative">
                                <input
                                    type="number"
                                    value={intervalValue}
                                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                                    className="w-full px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition"
                                    placeholder="Milisegundos"
                                />
                                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40 text-sm">
                                    ms
                                </span>
                            </div>

                            <button
                                onClick={handleIntervalChange}
                                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg transform transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500/50 flex items-center space-x-2"
                            >
                                <span>Aplicar Cambios</span>
                                <span className="text-xl">→</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Discos Section */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                            <span>💾</span>
                            <span>Discos Físicos</span>
                        </h2>
                        <span className="backdrop-blur-lg bg-white/10 text-white px-4 py-2 rounded-full text-sm border border-white/20">
                            {metrics.disks.length} {metrics.disks.length === 1 ? 'disco detectado' : 'discos detectados'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {metrics.disks.map((disk: any, i: number) => {
                            const usagePercent = (disk.diskUsedSpace / disk.diskSize) * 100;
                            const isCritical = usagePercent >= 90;
                            const isWarning = usagePercent >= 75 && usagePercent < 90;

                            return (
                                <div
                                    key={i}
                                    className="group backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl overflow-hidden border border-white/20 transform transition duration-500 hover:scale-105 hover:shadow-2xl"
                                >
                                    {/* Cabecera con efecto de brillo */}
                                    <div className={`relative h-2 ${isCritical ? 'bg-gradient-to-r from-red-500 to-pink-500' :
                                        isWarning ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                            'bg-gradient-to-r from-green-500 to-emerald-500'
                                        }`}>
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>

                                    <div className="p-6">
                                        {/* Título del disco */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center backdrop-blur-lg border border-white/10">
                                                    <span className="text-2xl">💿</span>
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-bold text-lg">Disco {disk.diskName}</h3>
                                                    <p className="text-white/40 text-sm">{disk.diskType}</p>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${disk.diskType === 'SSD'
                                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                                                }`}>
                                                {disk.diskType}
                                            </div>
                                        </div>

                                        {/* Métricas en 3D */}
                                        <div className="grid grid-cols-3 gap-3 mb-6">
                                            {[
                                                { label: 'Total', value: disk.diskSize, icon: '📊' },
                                                { label: 'Usado', value: disk.diskUsedSpace, icon: '📈' },
                                                { label: 'Libre', value: disk.diskFreeSpace, icon: '📉' }
                                            ].map((metric, idx) => (
                                                <div key={idx} className="bg-white/5 rounded-xl p-3 backdrop-blur-lg border border-white/10">
                                                    <p className="text-white/40 text-xs flex items-center gap-1">
                                                        <span>{metric.icon}</span>
                                                        {metric.label}
                                                    </p>
                                                    <p className="text-white font-bold text-lg">{metric.value} <span className="text-xs text-white/40">GB</span></p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Barra de progreso con animación */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-white/60">Uso del disco</span>
                                                <span className={`font-bold ${isCritical ? 'text-red-400' :
                                                    isWarning ? 'text-yellow-400' :
                                                        'text-green-400'
                                                    }`}>
                                                    {usagePercent.toFixed(1)}%
                                                </span>
                                            </div>

                                            <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${isCritical ? 'bg-gradient-to-r from-red-500 to-pink-500' :
                                                        isWarning ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                                            'bg-gradient-to-r from-green-500 to-emerald-500'
                                                        }`}
                                                    style={{ width: `${usagePercent}%` }}
                                                >
                                                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mensaje de alerta si es crítico */}
                                        {isCritical && (
                                            <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-xl p-3">
                                                <p className="text-red-300 text-sm flex items-center gap-2">
                                                    <span className="text-lg">⚠️</span>
                                                    Capacidad crítica - Se requiere acción inmediata
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Efecto de brillo en hover */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transform -skew-x-12 transition-opacity duration-700"></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer elegante */}
                <div className="text-center pt-8 pb-4">
                    <div className="inline-flex items-center space-x-2 backdrop-blur-xl bg-white/5 px-6 py-3 rounded-full border border-white/10">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-white/60 text-sm">Monitoreo en tiempo real</span>
                        <span className="text-white/20">|</span>
                        <span className="text-white/40 text-sm">Nodo Regional v1.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
};