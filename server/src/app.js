import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import packingRoutes from './routes/packingRoutes.js';
import productionRoutes from './routes/productionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import activityRoutes from './routes/activityRoutes.js';

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/packing', packingRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
