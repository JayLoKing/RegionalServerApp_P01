import React, { useEffect, useState } from "react";
import {
  HardDrive,
  AlertCircle,
  CheckCircle,
  XCircle,
  Server,
  Clock,
  Database,
  RefreshCw,
  BarChart3,
  Cpu,
  Activity,
  Calendar,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface NodeDisk {
  nodeId: string;
  diskName: string;
  diskType: string;
  diskSize: number;
  diskUsedSpace: number;
  diskFreeSpace: number;
  diskStatus: "UP" | "WARNING" | "DOWN";
  lastReport: Date;
  usagePercentage: number;
}

interface ClusterSummary {
  totalNodes: number;
  activeNodes: number;
  warningNodes: number;
  downNodes: number;
  totalCapacity: number;
  totalUsed: number;
  totalFree: number;
  globalUtilization: number;
  nodes: NodeDisk[];
  lastUpdated: Date;
}

const generateHistoricalData = (nodeId: string) => {
  const data = [];
  const today = new Date();
  for (let i = 14; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
      }),
      usage: 70 + Math.random() * 25, // Esto ya es porcentaje (70-95%)
      fullDate: date,
    });
  }
  return data;
};
const getTimeSinceLastReport = (lastReport: Date) => {
  if (!lastReport || lastReport.getTime() === 0) return "Nunca";

  const seconds = Math.floor(
    (new Date().getTime() - lastReport.getTime()) / 1000,
  );

  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds} segundos`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours !== 1 ? 's' : ''}`;

  const days = Math.floor(hours / 24);
  return `hace ${days} día${days !== 1 ? 's' : ''}`;
};
export const ClusterDashboard = () => {
  const [summary, setSummary] = useState<ClusterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeDisk | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  const fetchSummary = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("http://localhost:3000/api/cluster/summary");
      if (!response.ok) throw new Error("Error al cargar datos");
      const data = await response.json();

      const processedData = {
        ...data,
        lastUpdated: new Date(data.lastUpdated),
        nodes: data.nodes.map((node: any) => ({
          ...node,
          lastReport: new Date(node.lastReport),
        })),
      };

      setSummary(processedData);
      setError(null);
    } catch (err) {
      setError("Error de conexión con el servidor");
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();

    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(fetchSummary, refreshInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, refreshInterval]);

  const handleNodeClick = async (node: NodeDisk) => {
    setSelectedNode(node);

    try {
      // Llamar al backend para obtener el historial real
      const response = await fetch(
        `https://localhost:3000/api/cluster/history/${node.nodeId}`,
      );
      if (response.ok) {
        const data = await response.json();
        console.log("Datos del backend:", data);

        // Definir una interfaz para los datos formateados
        interface FormattedHistoryData {
          date: string;
          usage: number;
          fullDate: Date;
        }

        // Transformar los datos para el gráfico
        const formattedData: FormattedHistoryData[] = data.map((item: any) => {
          // Formatear fecha correctamente
          const dateObj = new Date(item.date);
          const formattedDate = dateObj.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
          });

          return {
            date: formattedDate,
            usage: item.usage, // Ahora viene como porcentaje desde el backend
            fullDate: dateObj,
          };
        });

        // Ordenar por fecha ascendente para el gráfico
        formattedData.sort(
          (a, b) => a.fullDate.getTime() - b.fullDate.getTime(),
        );
        setHistoricalData(formattedData);
      }
    } catch (error) {
      console.error("Error cargando historial:", error);
      setHistoricalData(generateHistoricalData(node.nodeId));
    }

    setShowModal(true);
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "UP":
        return <Wifi className="w-4 h-4 text-emerald-500" />;
      case "WARNING":
        return <Activity className="w-4 h-4 text-amber-500" />;
      case "DOWN":
        return <WifiOff className="w-4 h-4 text-rose-500" />;
      default:
        return <Server className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "UP":
        return "border-emerald-500 bg-emerald-50";
      case "WARNING":
        return "border-amber-500 bg-amber-50";
      case "DOWN":
        return "border-rose-500 bg-rose-50";
      default:
        return "border-slate-300 bg-slate-50";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 GB";

    // Si es menor a 1024 GB (1 TB), mostrar en GB
    if (bytes < 1024) {
      return `${bytes.toFixed(2)} GB`;
    }
    // Si es mayor o igual a 1024 GB, convertir a TB
    else {
      return `${(bytes / 1024).toFixed(2)} TB`;
    }
  };

  const formatDate = (date: Date) => {
    if (!date || date.getTime() === 0) return "Nunca";
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <p className="mt-4 text-slate-300 font-medium">
            Cargando dashboard del cluster...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Monitor Nacional de Almacenamiento
                </h1>
                <p className="text-sm text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Última actualización:{" "}
                  {summary?.lastUpdated && formatDate(summary.lastUpdated)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1 border border-white/20">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${autoRefresh
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-300 hover:bg-white/20"
                    }`}
                >
                  Auto
                </button>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  disabled={!autoRefresh}
                  className="bg-transparent border-none text-sm font-medium text-slate-300 focus:ring-0 cursor-pointer disabled:opacity-50"
                >
                  <option value="2000">2s</option>
                  <option value="5000">5s</option>
                  <option value="10000">10s</option>
                  <option value="30000">30s</option>
                </select>
              </div>

              <button
                onClick={fetchSummary}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Actualizar
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        {summary && (
          <>
            {/* Resumen Global */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-6 mb-6 text-white">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                  <p className="text-sm opacity-90 mb-1">
                    Capacidad Total del Cluster
                  </p>
                  <p className="text-3xl font-bold">
                    {formatBytes(summary.totalCapacity)}
                  </p>
                </div>
                <div className="flex gap-8">
                  <div className="text-center">
                    <p className="text-sm opacity-90">Usado</p>
                    <p className="text-xl font-semibold">
                      {formatBytes(summary.totalUsed)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm opacity-90">Libre</p>
                    <p className="text-xl font-semibold">
                      {formatBytes(summary.totalFree)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm opacity-90">Reportaron</p>
                    <p className="text-xl font-semibold">
                      {summary.activeNodes + summary.warningNodes} de{" "}
                      {summary.totalNodes}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-500"
                  style={{ width: `${summary.globalUtilization}%` }}
                ></div>
              </div>
            </div>

            {/* Grid de Nodos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {summary.nodes.map((node) => {
                const cityName = node.nodeId
                  .replace("CNS-", "")
                  .replace(/-/g, " ");
                const statusColor = getStatusColor(node.diskStatus);

                return (
                  <div
                    key={node.nodeId}
                    onClick={() =>
                      node.diskStatus !== "DOWN" && handleNodeClick(node)
                    }
                    className={`
                      ${statusColor} border-2 rounded-xl p-5 shadow-lg 
                      transition-all duration-300 hover:shadow-xl 
                      ${node.diskStatus !== "DOWN" ? "cursor-pointer transform hover:scale-105" : "opacity-75 cursor-not-allowed"}
                    `}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">
                          {cityName}
                        </h3>
                        <div className="flex items-center gap-1 mt-1">
                          {getStatusIcon(node.diskStatus)}
                          <span className="text-xs font-medium text-slate-600">
                            {node.diskStatus === "UP"
                              ? "En línea"
                              : node.diskStatus === "WARNING"
                                ? "Crítico"
                                : "Sin conexión"}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white/60 p-2 rounded-lg">
                        <HardDrive className="w-5 h-5 text-slate-700" />
                      </div>
                    </div>

                    {node.diskStatus !== "DOWN" ? (
                      <>
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">
                              Capacidad
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              {formatBytes(node.diskSize)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Uso</span>
                            <span className="text-sm font-semibold text-slate-800">
                              {formatBytes(node.diskUsedSpace)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">
                              Libre
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              {formatBytes(node.diskFreeSpace)}
                            </span>
                          </div>
                        </div>

                        <div className="relative pt-1">
                          <div className="flex mb-2 items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold inline-block text-slate-600">
                                {node.usagePercentage}% usado
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-600">
                              {node.diskType}
                            </span>
                          </div>
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-slate-200">
                            <div
                              style={{ width: `${node.usagePercentage}%` }}
                              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${node.usagePercentage > 90
                                ? "bg-rose-500"
                                : node.usagePercentage > 75
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                                }`}
                            ></div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-center text-slate-500">
                        <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No reporta</p>
                      </div>
                    )}

                    {/* Después - Reemplazar con: */}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3" />
                        {getTimeSinceLastReport(node.lastReport)}
                      </span>

                      {/* Indicador de estado con color más visible */}
                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${node.diskStatus === "UP"
                          ? "bg-emerald-100 text-emerald-700"
                          : node.diskStatus === "WARNING"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                          }`}
                      >
                        {node.diskStatus === "UP" && (
                          <Wifi className="w-3 h-3" />
                        )}
                        {node.diskStatus === "WARNING" && (
                          <Activity className="w-3 h-3" />
                        )}
                        {node.diskStatus === "DOWN" && (
                          <WifiOff className="w-3 h-3" />
                        )}
                        {node.diskStatus === "UP"
                          ? "En línea"
                          : node.diskStatus === "WARNING"
                            ? "Crítico"
                            : "Sin conexión"}
                      </span>
                    </div>

                    {/* Opcional: Si quieres mostrar la fecha exacta al hacer hover */}
                    <div className="mt-1 text-xs text-slate-400 opacity-0 hover:opacity-100 transition-opacity">
                      {formatDate(node.lastReport)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de Historial */}
      {showModal && selectedNode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {selectedNode.nodeId
                        .replace("CNS-", "")
                        .replace(/-/g, " ")}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Historial de uso de almacenamiento
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Información del nodo */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Capacidad Total</p>
                  <p className="text-xl font-bold text-slate-800">
                    {formatBytes(selectedNode.diskSize)}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Tipo de Disco</p>
                  <p className="text-xl font-bold text-slate-800">
                    {selectedNode.diskType}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Último Reporte</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDate(selectedNode.lastReport)}
                  </p>
                </div>
              </div>

              {/* Gráfico */}
              <div className="bg-slate-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Tendencia de uso histórico
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickMargin={15}
                      />
                      {/* Eliminamos el domain={[0, 100]} para que se autoescale a discos de cualquier tamaño (ej. 800 GB) */}
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickFormatter={(value) => `${value} GB`}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        formatter={(value: number | undefined) => {
                          // Si por alguna razón Recharts manda un undefined, devolvemos 0
                          if (value === undefined) return ["0.00 GB", "Espacio Usado"];
                          // Si es un número válido, lo formateamos a 2 decimales
                          return [`${value.toFixed(2)} GB`, "Espacio Usado"];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="usage"
                        stroke="#1d4ed8" // Azul oscuro similar a tu imagen
                        strokeWidth={3}
                        dot={{ r: 4, fill: "white", stroke: "#1d4ed8", strokeWidth: 2 }} // Puntos blancos con borde azul
                        activeDot={{ r: 6, fill: "#1d4ed8", stroke: "white" }}
                        name="Uso (GB)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabla de historial */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Registros históricos
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Uso (GB)
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                          Variación
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {historicalData.map((data, index) => {
                        const prevValue =
                          index > 0
                            ? historicalData[index - 1].usage
                            : data.usage;
                        const variation = data.usage - prevValue;
                        const variationColor =
                          variation > 0
                            ? "text-rose-600"
                            : variation < 0
                              ? "text-emerald-600"
                              : "text-slate-600";

                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {data.date}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-800">
                              {data.usage.toFixed(1)} GB
                            </td>
                            <td
                              className={`px-4 py-3 text-sm ${variationColor}`}
                            >
                              {variation > 0 ? "↑" : variation < 0 ? "↓" : "="}{" "}
                              {Math.abs(variation).toFixed(1)} GB
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
