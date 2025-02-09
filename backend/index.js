import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/index.js";

dotenv.config({
    path: "./.env"
});

const PORT = process.env.PORT || 8000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`⚙️ Server started at PORT: ${PORT}`);
    })
}).catch((error) => {
    console.log(`Database Connection Failed: ${error.message}`);
});