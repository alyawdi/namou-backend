import { logger } from '../lib/logger.js';
import { runMigrations, sqlite } from './client.js';

runMigrations();
logger.info('Database migrations applied');
sqlite.close();
