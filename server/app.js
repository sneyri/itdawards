import express from 'express';
import api from './routes/api.js';
import pages from './modules/pages/pagesRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/security.js';
import { rememberSystemError } from './modules/monitoring/system.js';
import { measureRequest } from './modules/monitoring/telemetry.js';

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');
    app.use(securityHeaders);
    app.use('/api', measureRequest, api);
    app.use(pages);
    app.use((error, _req, _res, next) => {
        if ((error.status ?? 500) >= 500) rememberSystemError('backend', error);
        next(error);
    });
    app.use(errorHandler);
    return app;
}
