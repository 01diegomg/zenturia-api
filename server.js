// --- server.js ---
// Entry point for the application
// All logic has been moved to src/app.js

import { startServer } from './src/app.js';

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
