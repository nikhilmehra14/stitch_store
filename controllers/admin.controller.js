import fs from "fs";
import path from "path";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";
import { Product } from "../models/product.model.js";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { generateAccessAndRefereshTokens } from "./user.controller.js";
import Coupon from "../models/coupon.model.js";

export const registerAdmin = async (req, res) => {
  try {
    const { email, fullName, phone, password } = req.body;

    if (!email || !fullName || !phone || !password) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ApiError(HttpStatus.BAD_REQUEST.code, "All fields are required.")
      );
    }

    const existingAdmin = await User.findOne({ email, role: "admin" });
    if (existingAdmin) {
      throw new ApiError(HttpStatus.BAD_REQUEST.code, "Admin with this email already exists.");
    }

    const newAdmin = new User({ email, fullName, phone, password, role: "admin" });
    await newAdmin.save();

    return res.status(HttpStatus.CREATED.code).json(
      new ApiResponse(HttpStatus.CREATED.code, newAdmin, "Admin registered successfully.")
    );
  } catch (error) {
    console.error(`Error while registering admin: ${error}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while registering admin.")
    );
  }
};

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Email and Password are required."));
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Admin doesn't exist"));
    }

    if (user.role !== 'admin') {
      return res.status(HttpStatus.FORBIDDEN.code).json(new ApiError(HttpStatus.FORBIDDEN.code, "You are not authorized to access this admin panel"));
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
      return res.status(HttpStatus.UNAUTHORIZED.code).json(new ApiError(HttpStatus.UNAUTHORIZED.code, "Password is incorrect"));
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
      httpOnly: true,
      secure: true
    }

    return res.status(HttpStatus.OK.code)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(HttpStatus.OK.code, { user: loggedInUser, accessToken, refreshToken }, "Admin logged in successfully"));
  } catch (error) {
    console.error(`Error while logging in admin: ${error.message}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while logging in admin", error.message));
  }
};


export const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isVerified: false }, { new: true }).select("-password -refreshToken");

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "User not found"));
    }

    return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, user, "User deactivated successfully"));
  } catch (error) {
    console.error("Error deactivating user:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error deactivating user"));
  }
};