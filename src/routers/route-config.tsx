import { RegionalNode } from "../regional-node/components/RegionalNode";

export const routesConfig = [
    {
        path: '/',
        element: <RegionalNode />
    },
    {
        path: 'dashboard',
        element: '<Aqui el componente del dashboard y charts>'
    }
];