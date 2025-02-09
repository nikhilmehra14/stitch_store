import express from "express";
import {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress,
} from "../controllers/address.controller.js";

const router = express.Router();

router.route("/").post(addAddress);
router.route("/:userId").get(getAddresses);
router.route("/:userId/:addressId").put(updateAddress);
router.route("/:userId/:addressId").delete(deleteAddress);

export default router;
