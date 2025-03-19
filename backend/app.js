import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./services/google.service.js";
import morgan from "morgan";
import helmet from "helmet";
import ApiResponse from "./utils/ApiResponse.js";
import { HttpStatus } from "./constants/status.code.js";

const app = express();


app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" },
  xssFilter: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
}));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:5173", "https://www.thestitchstore.in"];


app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));



app.use(express.json({ limit: "20mb" }));
app.use(morgan((tokens, req, res) => {
  const logParts = [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'),
    '-',
    tokens['response-time'](req, res), 'ms',
  ];
  return logParts.join(' ');
}));

app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(passport.initialize());

import userRoutes from "./routes/user.routes.js";
import googleRoutes from "./routes/google.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import productRoutes from "./routes/product.routes.js";
import addressRoutes from "./routes/address.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import authMiddleware from "./middlewares/auth.middleware.js";
import couponRoutes from "./routes/coupon.routes.js";
import orderRoutes from "./routes/order.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import carouselRoutes from "./routes/carousel.routes.js";

app.use("/auth", googleRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/address", authMiddleware, addressRoutes);
app.use("/api/v1/cart", authMiddleware, cartRoutes);
app.use("/api/v1/coupon", authMiddleware, couponRoutes);
app.use("/api/v1/order", authMiddleware, orderRoutes);
app.use("/api/v1/wishlist", authMiddleware, wishlistRoutes);
app.use("/api/v1/carousel", carouselRoutes);

app.get("/", (req, res) => {
    res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, [], "We'll live soon! Stay tuned!"));
});

app.use((req, res) => {
    res.status(HttpStatus.NOT_FOUND.code).json({ message: "404 No Page Found" });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json({
        message: "Something went wrong! Please try again later.",
        error: process.env.NODE_ENV === "development" ? err.message : undefined
    });
});

export default app;
