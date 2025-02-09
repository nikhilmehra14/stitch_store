import express from "express";
import { addToWishlist, moveToCart, removeFromWishlist, viewWishlist } from "../controllers/wishlist.controller.js";

const router = express.Router();

router.route("/add").post(addToWishlist);
router.route("/remove").post(removeFromWishlist);
router.route("/view").get(viewWishlist);
router.route("/move-to-cart").post(moveToCart);

export default router;