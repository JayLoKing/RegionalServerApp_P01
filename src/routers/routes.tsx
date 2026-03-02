import { Suspense } from "react";
import { routesConfig } from "./route-config";
import { useRoutes } from "react-router-dom";

export const AppRoutes = () => {
    const routing = useRoutes(routesConfig);

    return (
        <Suspense fallback={<h2>Cargando..</h2>}>
            {routing}
        </Suspense>
    );
}