// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { RegionalNode } from "./regional-node/components/RegionalNode";
import { ClusterDashboard } from "./cluster-dashboard/components/ClusterDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RegionalNode />} />
      <Route path="/dashboard" element={<ClusterDashboard />} />
    </Routes>
  );
}