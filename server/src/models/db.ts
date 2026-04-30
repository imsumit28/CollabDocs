import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');

  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(uri);
      console.log('✅ MongoDB connected');
      return;
    } catch (err) {
      retries--;
      console.error(`MongoDB connection failed. Retries left: ${retries}`, err);
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected');
});
