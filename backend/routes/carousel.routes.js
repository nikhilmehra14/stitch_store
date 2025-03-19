import express from "express";
import { upload } from "../utils/multer.js";
import {
    createCarousel,
    getCarousels,
    getCarouselById,
    updateCarousel,
    deleteCarousel,
} from "../controllers/carousel.controller.js";
import authMiddleware, { adminMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.route("/").get(getCarousels);
router.get("/:id", getCarouselById);
router.use(authMiddleware, adminMiddleware);
router.route("/").post(upload.single("image"), createCarousel);
router.route("/:id").put(upload.single("image"), updateCarousel);
router.route("/:id").delete(deleteCarousel);

export default router;
