import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
    try {
        console.log(`${process.env.DB_URI}`);
	const connectionInstance = await mongoose.connect(`${process.env.DB_URI}`, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        console.log(`Database Connected Successfully! DB HOST: ${connectionInstance?.connection?.host}`);
    } catch (error) {
        console.log(`Database Connection Failed: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
