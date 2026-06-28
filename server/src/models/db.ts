import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');

  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(uri);
      logger.info('MongoDB connected');
      return;
    } catch (err) {
      retries--;
      logger.error({ err, retries }, 'MongoDB connection failed');
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});
