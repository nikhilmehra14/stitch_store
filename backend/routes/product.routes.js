import express from "express";
import { upload } from "../utils/multer.js";
import { addProduct, getProducts, deleteProduct, getProductById, updateProduct } from "../controllers/product.controller.js";
import authMiddleware, { adminMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/").get(getProducts);
router.route("/:id").get(getProductById)

router.use(authMiddleware, adminMiddleware);
router.route("/").post(upload.array("images", 6), addProduct);

router
  .route("/:id")
  .put(upload.array("images", 6), updateProduct)
  .delete(deleteProduct);

export default router;