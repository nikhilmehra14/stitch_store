import express from "express";
import { addToCart, getCart, updateCartItemQuantity, clearCart, deleteCartItem } from "../controllers/cart.controller.js";

const router = express.Router();

router.route("/").post(addToCart);

router.route("/").get(getCart);

router.route("/").put(updateCartItemQuantity);

router.route("/").delete(clearCart);

router.route("/:id").delete(deleteCartItem);

export default router;
