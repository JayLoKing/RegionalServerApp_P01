import { useEffect, useState } from 'react';

export const RegionalNode = () => {
    const [metrics, setMetrics] = useState<any>(null);
    const [cnsCommand, setCnsCommand] = useState<string>('');
    const [intervalValue, setIntervalValue] = useState(5000);
    const [ws, setWs] = useState<WebSocket | null>(null);

    useEffect(() => {
        // Conectar al agente local en Bun
        const localWs = new WebSocket('ws://localhost:4000');

        localWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'METRICS_UPDATE') {
                setMetrics(data.payload);
            } else if (data.type === 'CNS_COMMAND') {
                const parsedCmd = JSON.parse(data.payload);
                setCnsCommand(parsedCmd.response.command);
            }
        };

        setWs(localWs);
        return () => localWs.close();
    }, []);

    // Requisito 7.3: Auto Refresh Parametrizable desde el cliente
    const handleIntervalChange = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'CHANGE_INTERVAL', value: intervalValue }));
            alert(`Intervalo de reporte actualizado a ${intervalValue}ms`);
        }
    };

    if (!metrics) return <div style={{ padding: 20 }}>Conectando al Agente Local...</div>;

    return (
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
            <h1>🖥️ Nodo Regional: {metrics.nodeId}</h1>

            {cnsCommand !== 'NONE' && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
                    <strong>Alerta del Servidor Central:</strong> {cnsCommand}
                </div>
            )}

            <div style={{ marginBottom: '20px', padding: '15px', background: '#f3f4f6', borderRadius: '8px' }}>
                <label><strong>⚙️ Auto-Refresh (Milisegundos): </strong></label>
                <input
                    type="number"
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                    style={{ marginLeft: '10px', padding: '5px' }}
                />
                <button onClick={handleIntervalChange} style={{ marginLeft: '10px', padding: '5px 10px', cursor: 'pointer' }}>
                    Aplicar
                </button>
            </div>

            <h2>Discos Físicos Detectados</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {metrics.disks.map((disk: any, i: number) => {
                    const usagePercent = (disk.diskUsedSpace / disk.diskSize) * 100;
                    const isCritical = usagePercent >= 90;

                    return (
                        <div key={i} style={{
                            border: `2px solid ${isCritical ? 'red' : '#ccc'}`,
                            padding: '15px',
                            borderRadius: '8px',
                            minWidth: '250px'
                        }}>
                            <h3>Disco {disk.diskName} ({disk.diskType})</h3>
                            <p><strong>Total:</strong> {disk.diskSize} GB</p>
                            <p><strong>Usado:</strong> {disk.diskUsedSpace} GB</p>
                            <p><strong>Libre:</strong> {disk.diskFreeSpace} GB</p>

                            <div style={{ width: '100%', background: '#eee', height: '20px', borderRadius: '10px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${usagePercent}%`,
                                    background: isCritical ? 'red' : 'green',
                                    height: '100%'
                                }}></div>
                            </div>
                            <p style={{ textAlign: 'center', margin: '5px 0 0 0' }}>{usagePercent.toFixed(1)}%</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};