import express from "express";
import { confirmOrder, createOrder, deleteOrder, getAllOrders, getUserOrders } from "../controllers/order.controller.js";
import { adminMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/").post(createOrder);

router.route("/confirm").post(confirmOrder);

router.route("/user-orders").get(getUserOrders);

router.route("/").delete(deleteOrder);

router.use(adminMiddleware);

router.route("/").get(getAllOrders);

export default router;