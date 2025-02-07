import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./services/google.service.js";
import morgan from "morgan";
import ApiResponse from "./utils/ApiResponse.js";
import { HttpStatus } from "./constants/status.code.js";

const app = express();

app.use(passport.initialize());

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ["http://localhost:5173"];
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));


app.use(morgan('dev'));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());


import userRoutes from "./routes/user.routes.js";
import googleRoutes from "./routes/google.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import productRoutes from "./routes/product.routes.js"
import addressRoutes from "./routes/address.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import authMiddleware from "./middlewares/auth.middleware.js";
import couponRoutes from "./routes/coupon.routes.js";
import orderRoutes from "./routes/order.routes.js";

app.use("/auth", googleRoutes)
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/address", authMiddleware, addressRoutes);
app.use("/api/v1/cart", authMiddleware, cartRoutes);
app.use("/api/v1/coupon", authMiddleware, couponRoutes);
app.use("/api/v1/order", authMiddleware, orderRoutes);

app.get("/", (req, res) => {
    res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, [], "We'll live soon! Stay tuned!"));
});

app.use((req, res, next) => {
    res.status(HttpStatus.NOT_FOUND.code).json({ message: "404 No Page Found" });
});


export default app;