import { RegionalNode } from "../regional-node/components/RegionalNode";
import { ClusterDashboard } from "../cluster-dashboard/components/ClusterDashboard";

export const routesConfig = [
    {
        path: '/',
        element: <RegionalNode />
    },
    {
        path: '/dashboard',
        element: <ClusterDashboard/>
    }
];