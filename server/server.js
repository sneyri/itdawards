import express from 'express';
import api from './routes/api.js';
import auth from './routes/auth.js';
import frontend from './routes/frontend.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/security.js';
import { startLocalAuth } from './startLocalAuth.js';

const app = express();
const port = process.env.PORT || 3000;

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');
app.use(securityHeaders);
app.use(auth);
app.use('/api', api);
app.use(frontend);
app.use(errorHandler);

app.listen(port, '127.0.0.1', (error) => {
    if (error) {
        console.error('Ошибка запуска Express:', error.message);
        process.exitCode = 1;
        return;
    }
    console.log(`ITD Awards — http://127.0.0.1:${port}`);
    startLocalAuth();
});
