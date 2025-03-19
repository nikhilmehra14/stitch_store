import express from "express";
import { applyCoupon, createCoupon, deleteCoupon, editCoupon, getCoupons, getCouponsById, verifyCoupon, removeCoupon } from "../controllers/coupon.controller.js";
import { adminMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/verify").get(verifyCoupon);
router.route("/apply").post(applyCoupon);
router.route("/remove").post(removeCoupon);
router.route("/").get(getCoupons);
router.use(adminMiddleware);
router.route("/:id").get(getCouponsById);
router.route("/").post(createCoupon);
router.route("/:id").put(editCoupon);
router.route("/:id").delete(deleteCoupon);

export default router;
