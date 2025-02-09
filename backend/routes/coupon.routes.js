import express from "express";
import { applyCoupon, createCoupon, deleteCoupon, editCoupon, getCoupons, getCouponsById, verifyCoupon } from "../controllers/coupon.controller.js";
import { adminMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/verify").get(verifyCoupon);
router.route("/apply").post(applyCoupon);
router.use(adminMiddleware);
router.route("/").get(getCoupons);
router.route("/:id").get(getCouponsById);
router.route("/").post(createCoupon);
router.route("/:id").put(editCoupon);
router.route("/:id").delete(deleteCoupon);

export default router;