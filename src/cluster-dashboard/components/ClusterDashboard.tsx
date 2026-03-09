import React, { useEffect, useState, useCallback } from "react";
import {
  HardDrive, AlertCircle, XCircle, Server, Clock, Database,
  RefreshCw, BarChart3, Activity, Calendar, TrendingUp, TrendingDown,
  Wifi, WifiOff, Timer, Zap, FileText, ChevronDown, ChevronUp,
  Download, RotateCcw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────

interface NodeDisk {
  nodeId: string;
  diskName: string;
  diskType: string;
  diskSize: number;
  diskUsedSpace: number;
  diskFreeSpace: number;
  diskIOPS: number;
  diskStatus: "UP" | "WARNING" | "DOWN";
  lastReport: Date;
  usagePercentage: number;
  registerDate: Date;
  uptimeSeconds: number;
  growthRateGBPerDay: number;
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
  avgLatencyMs: number;
  globalGrowthRateGBPerDay: number;
  nodes: NodeDisk[];
  lastUpdated: Date;
}

interface LogFile {
  name: string;
  sizeBytes: number;
  lastModified: string;
}

interface LogContent {
  file: string;
  totalLines: number;
  showing: number;
  lines: string[];
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const formatBytes = (gb: number) => {
  if (gb === 0) return "0 GB";
  if (gb < 1024) return `${gb.toFixed(2)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
};

const formatDate = (date: Date) => {
  if (!date || date.getTime() === 0) return "Nunca";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
};

const getTimeSinceLastReport = (lastReport: Date) => {
  if (!lastReport || lastReport.getTime() === 0) return "Nunca";
  const seconds = Math.floor((new Date().getTime() - lastReport.getTime()) / 1000);
  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds} segundos`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} minuto${minutes !== 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days !== 1 ? "s" : ""}`;
};

const formatUptime = (seconds: number) => {
  if (!seconds || seconds < 0) return "N/A";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// Colorea cada línea del log según su contenido
const getLineColor = (line: string) => {
  if (line.includes("WARNING") || line.includes("CRITICO")) return "text-amber-400";
  if (line.includes("ERROR") || line.includes("DOWN") || line.includes("CAIDO")) return "text-rose-400";
  if (line.includes("SUCCESS") || line.includes("ACK") || line.includes("CONEXION_ESTABLECIDA")) return "text-emerald-400";
  if (line.includes("REJECTED")) return "text-orange-400";
  if (line.includes("CONFIRMACION") || line.includes("ACK_OK")) return "text-sky-400";
  return "text-slate-300";
};

// Nombre amigable para el tipo de log
const getLogLabel = (name: string) => {
  if (name.startsWith("auditoria_")) return { label: "Auditoría", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
  if (name.startsWith("client_acks_")) return { label: "ACKs Cliente", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
  if (name.startsWith("nodos_caidos_")) return { label: "Nodos Caídos", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
  return { label: "Log", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
};

// ─────────────────────────────────────────────
// COMPONENTE: VISOR DE LOGS
// ─────────────────────────────────────────────

const LogViewer = ({ onClose }: { onClose: () => void }) => {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<LogContent | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [liveRefresh, setLiveRefresh] = useState(true);
  const logEndRef = React.useRef<HTMLDivElement>(null);
  const selectedFileRef = React.useRef<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3000/api/logs/list");
      const data = await res.json();
      setFiles(data.files ?? []);
      if (data.files?.length > 0 && !selectedFileRef.current) {
        setSelectedFile(data.files[0].name);
        selectedFileRef.current = data.files[0].name;
      }
    } catch {
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const fetchContent = useCallback(async (fileName: string, silent = false) => {
    if (!silent) setLoadingContent(true);
    try {
      const res = await fetch(
        `http://localhost:3000/api/logs/content?file=${encodeURIComponent(fileName)}&lines=200`
      );
      const data = await res.json();
      setContent(data);
    } catch {
      setContent(null);
    } finally {
      if (!silent) setLoadingContent(false);
    }
  }, []);

  // Cargar lista al abrir
  useEffect(() => { fetchFiles(); }, []);

  // Cargar contenido cuando cambia el archivo seleccionado
  useEffect(() => {
    if (selectedFile) {
      selectedFileRef.current = selectedFile;
      fetchContent(selectedFile);
    }
  }, [selectedFile]);

  // ✅ TIEMPO REAL: recargar cada 500ms
  useEffect(() => {
    if (!liveRefresh) return;
    const id = setInterval(() => {
      if (selectedFileRef.current) fetchContent(selectedFileRef.current, true);
    }, 500);
    return () => clearInterval(id);
  }, [liveRefresh, fetchContent]);

  // Auto-scroll al final
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [content, autoScroll]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col border border-slate-700">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-slate-700 to-slate-600 rounded-xl">
              <FileText className="w-5 h-5 text-slate-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Visor de Logs del Servidor</h2>
              <p className="text-xs text-slate-400">
                {files.length} archivo{files.length !== 1 ? "s" : ""} disponible{files.length !== 1 ? "s" : ""} · logs_servidor_central/
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectedFile && fetchContent(selectedFile)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-xs transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Recargar
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Panel izquierdo: lista de archivos ── */}
          <div className="w-64 border-r border-slate-700 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-slate-700">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Archivos</span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {loadingFiles ? (
                <div className="text-center py-8 text-slate-500 text-sm">Cargando...</div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs px-3">
                  No hay archivos .log generados todavía
                </div>
              ) : (
                files.map((file) => {
                  const { label, color } = getLogLabel(file.name);
                  const isSelected = selectedFile === file.name;
                  return (
                    <button
                      key={file.name}
                      onClick={() => setSelectedFile(file.name)}
                      className={`w-full text-left p-3 rounded-xl transition-all ${isSelected
                        ? "bg-blue-600/20 border border-blue-500/40"
                        : "hover:bg-slate-800 border border-transparent"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${color}`}>
                          {label}
                        </span>
                        <span className="text-[10px] text-slate-500">{formatFileSize(file.sizeBytes)}</span>
                      </div>
                      <p className={`text-xs font-mono truncate ${isSelected ? "text-blue-300" : "text-slate-400"}`}>
                        {file.name}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {new Date(file.lastModified).toLocaleString("es-ES", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Panel derecho: contenido del log ── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Barra de info del archivo */}
            {content && (
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-400">{content.file}</span>
                  <span className="text-[10px] text-slate-600">
                    Mostrando {content.showing} de {content.totalLines} líneas
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* ✅ Control de tiempo real */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${liveRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                    <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={liveRefresh}
                        onChange={e => setLiveRefresh(e.target.checked)}
                        className="w-3 h-3 accent-emerald-500"
                      />
                      {liveRefresh ? "En vivo" : "Pausado"}
                    </label>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={e => setAutoScroll(e.target.checked)}
                      className="w-3 h-3 accent-blue-500"
                    />
                    Auto-scroll
                  </label>
                </div>
              </div>
            )}

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 font-mono text-xs">
              {loadingContent ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="text-center">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                    <p>Cargando contenido...</p>
                  </div>
                </div>
              ) : !selectedFile ? (
                <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                  Selecciona un archivo para ver su contenido
                </div>
              ) : content?.lines?.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                  El archivo está vacío
                </div>
              ) : (
                <>
                  {content?.lines.map((line, i) => (
                    <div key={i} className="flex gap-3 hover:bg-slate-800/40 px-1 py-0.5 rounded group">
                      {/* Número de línea */}
                      <span className="text-slate-700 select-none w-8 text-right flex-shrink-0 group-hover:text-slate-500">
                        {(content.totalLines - content.showing + i + 1)}
                      </span>
                      {/* Contenido de la línea con coloreado */}
                      <span className={`break-all leading-relaxed ${getLineColor(line)}`}>
                        {line}
                      </span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

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
  const [showLogs, setShowLogs] = useState(false); // ✅ NUEVO

  const fetchSummary = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("http://localhost:3000/api/cluster/summary");
      if (!response.ok) throw new Error("Error al cargar datos");
      const data = await response.json();
      setSummary({
        ...data,
        lastUpdated: new Date(data.lastUpdated),
        nodes: data.nodes.map((node: any) => ({
          ...node,
          lastReport: new Date(node.lastReport),
          registerDate: new Date(node.registerDate),
        })),
      });
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
    if (autoRefresh) intervalId = setInterval(fetchSummary, refreshInterval);
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [autoRefresh, refreshInterval]);

  const handleNodeClick = async (node: NodeDisk) => {
    setSelectedNode(node);
    try {
      const response = await fetch(`http://localhost:3000/api/cluster/history/${node.nodeId}`);
      if (response.ok) {
        const data = await response.json();
        interface FormattedHistoryData { date: string; usage: number; fullDate: Date; }
        const formattedData: FormattedHistoryData[] = data.map((item: any) => {
          const dateObj = new Date(item.date);
          return {
            date: dateObj.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
            usage: item.usage,
            fullDate: dateObj,
          };
        });
        formattedData.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
        setHistoricalData(formattedData);
      }
    } catch (error) {
      console.error("Error cargando historial:", error);
      setHistoricalData([]);
    }
    setShowModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "UP": return <Wifi className="w-4 h-4 text-emerald-500" />;
      case "WARNING": return <Activity className="w-4 h-4 text-amber-500" />;
      case "DOWN": return <WifiOff className="w-4 h-4 text-rose-500" />;
      default: return <Server className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "UP": return "border-emerald-500 bg-emerald-50";
      case "WARNING": return "border-amber-500 bg-amber-50";
      case "DOWN": return "border-rose-500 bg-rose-50";
      default: return "border-slate-300 bg-slate-50";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <p className="mt-4 text-slate-300 font-medium">Cargando dashboard del cluster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── HEADER ── */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Monitor Nacional de Almacenamiento</h1>
                <p className="text-sm text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Última actualización: {summary?.lastUpdated && formatDate(summary.lastUpdated)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* ✅ NUEVO: Botón de logs */}
              <button
                onClick={() => setShowLogs(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-lg text-slate-200 text-sm transition-all shadow-lg hover:shadow-xl"
              >
                <FileText className="w-4 h-4 text-slate-300" />
                Ver Logs
              </button>

              <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1 border border-white/20">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${autoRefresh ? "bg-blue-600 text-white shadow-md" : "text-slate-300 hover:bg-white/20"}`}
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
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
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
            {/* ── RESUMEN GLOBAL ── */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-6 mb-6 text-white">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                  <p className="text-sm opacity-90 mb-1">Capacidad Total del Cluster</p>
                  <p className="text-3xl font-bold">{formatBytes(summary.totalCapacity)}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                  <div>
                    <p className="text-sm opacity-75">Usado</p>
                    <p className="text-xl font-semibold">{formatBytes(summary.totalUsed)}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-75">Libre</p>
                    <p className="text-xl font-semibold">{formatBytes(summary.totalFree)}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-75 flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" /> Latencia
                    </p>
                    <p className="text-xl font-semibold">{(summary.avgLatencyMs || 0).toFixed(3)} ms</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-75 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Crecimiento
                    </p>
                    <p className={`text-xl font-semibold ${summary.globalGrowthRateGBPerDay > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                      {summary.globalGrowthRateGBPerDay > 0 ? "+" : ""}
                      {(summary.globalGrowthRateGBPerDay || 0).toFixed(2)} GB/día
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-500"
                  style={{ width: `${Math.min(summary.globalUtilization, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs opacity-60">
                <span>{summary.globalUtilization}% utilizado</span>
                <span>Reportaron {summary.activeNodes + summary.warningNodes} de {summary.totalNodes} nodos</span>
              </div>
            </div>

            {/* ── GRID DE NODOS ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {summary.nodes.map((node) => {
                const cityName = node.nodeId.replace("CNS-", "").replace(/-/g, " ");
                const statusColor = getStatusColor(node.diskStatus);
                return (
                  <div
                    key={node.nodeId}
                    onClick={() => node.diskStatus !== "DOWN" && handleNodeClick(node)}
                    className={`
                      ${statusColor} border-2 rounded-xl p-5 shadow-lg
                      transition-all duration-300 hover:shadow-xl
                      ${node.diskStatus !== "DOWN" ? "cursor-pointer transform hover:scale-105" : "opacity-75 cursor-not-allowed"}
                    `}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{cityName}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          {getStatusIcon(node.diskStatus)}
                          <span className="text-xs font-medium text-slate-600">
                            {node.diskStatus === "UP" ? "En línea" : node.diskStatus === "WARNING" ? "Crítico" : "Sin conexión"}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white/60 p-2 rounded-lg">
                        <HardDrive className="w-5 h-5 text-slate-700" />
                      </div>
                    </div>

                    {node.diskStatus !== "DOWN" ? (
                      <>
                        <div className="space-y-1.5 mb-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Capacidad</span>
                            <span className="text-sm font-semibold text-slate-800">{formatBytes(node.diskSize)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Uso</span>
                            <span className="text-sm font-semibold text-slate-800">{formatBytes(node.diskUsedSpace)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Libre</span>
                            <span className="text-sm font-semibold text-slate-800">{formatBytes(node.diskFreeSpace)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600 flex items-center gap-1">
                              <Timer className="w-3 h-3" /> Uptime
                            </span>
                            <span className="text-sm font-semibold text-slate-700">{formatUptime(node.uptimeSeconds)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600 flex items-center gap-1">
                              {node.growthRateGBPerDay > 0.5
                                ? <TrendingUp className="w-3 h-3 text-rose-500" />
                                : node.growthRateGBPerDay < 0
                                  ? <TrendingDown className="w-3 h-3 text-emerald-500" />
                                  : <Activity className="w-3 h-3 text-slate-400" />}
                              Crecimiento
                            </span>
                            <span className={`text-sm font-semibold ${node.growthRateGBPerDay > 0.5 ? "text-rose-600" : node.growthRateGBPerDay < 0 ? "text-emerald-600" : "text-slate-600"}`}>
                              {node.growthRateGBPerDay > 0 ? "+" : ""}{node.growthRateGBPerDay.toFixed(2)} GB/día
                            </span>
                          </div>
                        </div>

                        <div className="relative pt-1">
                          <div className="flex mb-2 items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600">{node.usagePercentage}% usado</span>
                            <span className="text-xs font-semibold text-slate-600">{node.diskType}</span>
                          </div>
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-slate-200">
                            <div
                              style={{ width: `${node.usagePercentage}%` }}
                              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${node.usagePercentage > 90 ? "bg-rose-500" :
                                node.usagePercentage > 75 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-center text-slate-500">
                        <XCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No reporta</p>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3" />
                        {getTimeSinceLastReport(node.lastReport)}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${node.diskStatus === "UP" ? "bg-emerald-100 text-emerald-700" :
                        node.diskStatus === "WARNING" ? "bg-amber-100 text-amber-700" :
                          "bg-rose-100 text-rose-700"
                        }`}>
                        {node.diskStatus === "UP" && <Wifi className="w-3 h-3" />}
                        {node.diskStatus === "WARNING" && <Activity className="w-3 h-3" />}
                        {node.diskStatus === "DOWN" && <WifiOff className="w-3 h-3" />}
                        {node.diskStatus === "UP" ? "En línea" : node.diskStatus === "WARNING" ? "Crítico" : "Sin conexión"}
                      </span>
                    </div>
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

      {/* ── MODAL HISTORIAL ── */}
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
                      {selectedNode.nodeId.replace("CNS-", "").replace(/-/g, " ")}
                    </h2>
                    <p className="text-sm text-slate-500">Historial de uso de almacenamiento</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <XCircle className="w-6 h-6 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Capacidad Total</p>
                  <p className="text-xl font-bold text-slate-800">{formatBytes(selectedNode.diskSize)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Tipo de Disco</p>
                  <p className="text-xl font-bold text-slate-800">{selectedNode.diskType}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                    <Timer className="w-3 h-3" /> Uptime
                  </p>
                  <p className="text-xl font-bold text-slate-800">{formatUptime(selectedNode.uptimeSeconds)}</p>
                  <p className="text-xs text-slate-400 mt-1">desde {formatDate(selectedNode.registerDate)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Crecimiento
                  </p>
                  <p className={`text-xl font-bold ${selectedNode.growthRateGBPerDay > 0.5 ? "text-rose-600" : "text-emerald-600"}`}>
                    {selectedNode.growthRateGBPerDay > 0 ? "+" : ""}
                    {selectedNode.growthRateGBPerDay.toFixed(2)} GB/día
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Tendencia de uso histórico
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickMargin={15} />
                      <YAxis stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(v) => `${v} GB`} width={80} />
                      <Tooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload || !payload.length) return null;
                          const val = payload[0]?.value;
                          const num = typeof val === "number" ? val : parseFloat(String(val ?? 0));
                          return (
                            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}>
                              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{label}</p>
                              <p style={{ margin: 0, fontWeight: 600, color: "#1d4ed8" }}>{isNaN(num) ? "0.00" : num.toFixed(2)} GB</p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone" dataKey="usage" stroke="#1d4ed8" strokeWidth={3}
                        dot={{ r: 4, fill: "white", stroke: "#1d4ed8", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#1d4ed8", stroke: "white" }}
                        name="Uso (GB)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Registros históricos
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Fecha</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Uso (GB)</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Variación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {historicalData.map((data, index) => {
                        const prevValue = index > 0 ? historicalData[index - 1].usage : data.usage;
                        const variation = data.usage - prevValue;
                        const variationColor = variation > 0 ? "text-rose-600" : variation < 0 ? "text-emerald-600" : "text-slate-600";
                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm text-slate-600">{data.date}</td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-800">{data.usage.toFixed(2)} GB</td>
                            <td className={`px-4 py-3 text-sm ${variationColor}`}>
                              {variation > 0 ? "↑" : variation < 0 ? "↓" : "="} {Math.abs(variation).toFixed(2)} GB
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

      {/* ── VISOR DE LOGS ── */}
      {showLogs && <LogViewer onClose={() => setShowLogs(false)} />}
    </div>
  );
};
