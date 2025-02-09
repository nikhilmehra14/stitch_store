import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
    try {
        console.log(`${process.env.DB_URI}/${process.env.DB_NAME}`);
        const connectionInstance =  await mongoose.connect(`${process.env.DB_URI}/${process.env.DB_NAME}`);
        console.log(`Database Connected Successfully! DB HOST: ${connectionInstance?.connection?.host}`);
    } catch (error) {
        console.log(`Database Connection Failed: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;