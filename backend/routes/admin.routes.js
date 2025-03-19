import express from "express";
import { loginAdmin, isLoggedIn } from "../controllers/admin.controller.js";
import { logout, loginLimiter } from "../controllers/user.controller.js";
import authMiddleware, { adminMiddleware } from "../middlewares/auth.middleware.js";
import couponRoutes from "../routes/cart.routes.js";

const router = express.Router();

router.route("/login").post(loginAdmin);
router.use(authMiddleware, adminMiddleware);
router.route("/authorize").get(isLoggedIn);
router.route("/logout").post(logout);
router.use(adminMiddleware, couponRoutes);

export default router;
