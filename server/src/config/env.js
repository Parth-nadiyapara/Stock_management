import dotenv from 'dotenv';

dotenv.config();

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    // Fail loudly at boot rather than later with a confusing DB error.
    console.error(`Missing required environment variable: ${key}`);
    console.error('Copy server/.env.example to server/.env and fill in the values.');
    process.exit(1);
  }
}

export const env = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  jwtSecret: process.env.JWT_SECRET,
  port: process.env.PORT || 4000,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  lowStockThresholdKg: Number(process.env.LOW_STOCK_THRESHOLD_KG || 50),
};
