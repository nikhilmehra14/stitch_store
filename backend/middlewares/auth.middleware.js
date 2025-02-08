import dotenv from "dotenv";
import { HttpStatus } from "../constants/status.code.js";
import ApiError from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

dotenv.config({ path: "./.env" });

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", " ");
        if (!token) {
            return res.status(HttpStatus.UNAUTHORIZED.code).json(new ApiError(HttpStatus.UNAUTHORIZED.code, "Invalid Token"));
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        console.log("Decoded token: ", decodedToken);

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
        if (!user) {
            return res.status(HttpStatus.UNAUTHORIZED.code).json(new ApiError(HttpStatus.UNAUTHORIZED.code, "Invalid Token"));
        }

        req.user = user; // Attach user data to request
        next();
    } catch (error) {
        console.log(`Error while verifying Token: ${error.message}`);
        return res.status(HttpStatus.UNAUTHORIZED.code).json(new ApiError(HttpStatus.UNAUTHORIZED.code, "Invalid Token"));
    }
};

export const adminMiddleware = async (req, res, next) => {
    if (req.user?.role !== "admin") {
        return res.status(HttpStatus.FORBIDDEN.code).json(new ApiError(HttpStatus.FORBIDDEN.code, "Access Denied. Admins only."));
    }
    next();
};

export default authMiddleware;
