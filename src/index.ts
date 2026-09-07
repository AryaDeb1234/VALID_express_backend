import express from 'express';
import cors from 'cors';
import { config } from './config/db';
import userRoutes from './routes/User_route';
import inspectionRoutes from './routes/Inspection_route';
import { errorHandler } from './middleware/errorMiddleware';
import mongoose from 'mongoose'; 

const app = express();

app.get('/', (req, res) => {
  res.send('Welcome to the Express TypeScript Server!');
}
);
 

export const connectDB = async () => {
  try {
    await mongoose.connect(config.dbUrl, { 
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
      bufferCommands: false,
    });  
    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Connection Failed:', error);
    throw error;  
  }
};
 
app.use(cors({
  origin: [
    "http://localhost:3000"
  ],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use(express.json());

// Routes 
app.use('/user', userRoutes);
//app.use('/api/v1/inspections', inspectionRoutes);
app.use('/inspections', inspectionRoutes);


app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});
 

app.use(errorHandler); 

const startServer = async () => {
  try {
    console.log(`Inspection service mode: ${config.useMockInspectionService ? 'MOCK' : 'PYTHON'}`);
    await connectDB();
    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  } catch {
    process.exitCode = 1;
  }
};

startServer();