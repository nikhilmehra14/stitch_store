import express from "express";
import { upload } from "../utils/multer.js";
import { forgotPassword, getAllUsers, getUserById, loginUser, logout, registerUser,loginLimiter, resetPasswordLimiter, updateUser, verifyOTPAndChangePassword, verifySignupOTP, getMyProfile, isLoggedIn } from "../controllers/user.controller.js";
import authMiddleware, { adminMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/register").post(registerUser);

router.route("/verify-otp").post(verifySignupOTP);
router.route("/login").post(loginLimiter, loginUser);
router.route("/forgot-password").post(resetPasswordLimiter, forgotPassword);
router.route("/verify-password").post(verifyOTPAndChangePassword)

router.use(authMiddleware);

router.route("/authorize").get(isLoggedIn);
router.route("/logout").post(logout);
router.route("/edit").put(updateUser);
router.route("/profile").get(getMyProfile);

router.use(adminMiddleware);
router.route("/").get(getAllUsers);
router.route("/:id").get(getUserById);
export default router;
