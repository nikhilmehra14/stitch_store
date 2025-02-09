import { User } from "../models/user.model.js"
import { HttpStatus } from "../constants/status.code.js";
import { generateAndStoreOTP, sendOtpEmail } from "../utils/otp.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { setDataWithExpiry, getData, deleteData } from "../services/redis.service.js";
import sendResetPasswordEmail from "../services/forgot-password.service.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const resetPasswordLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1,
  message: "Please try again after 5 minutes",
  keyGenerator: (req) => req.body.email,
  handler: (req, res, next) => {
    return res.status(HttpStatus.RETRY_AFTER.code).json(new ApiError(HttpStatus.RETRY_AFTER.code, "Please try after 5 minutes", HttpStatus.RETRY_AFTER.text))
  }
});

export const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }


  } catch (error) {
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Something went wrong while generating referesh and access token")
  }
}


const registerUser = async (req, res) => {
  try {
    const { email, fullName, password } = req.body;

    if (!email || !fullName || !password) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "All fields are required."));
    }

    if (fullName.length < 3 || fullName.length > 100) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Full name must be between 3 and 100 characters."));
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Email already exists"));
    }

    const otpKey = email;
    const otp = generateAndStoreOTP(otpKey);

    const userDetails = { email, fullName, password };
    await setDataWithExpiry(otpKey, { otp, userDetails }, process.env.OTP_EXPIRY);


    if (email) {
      await sendOtpEmail(email, fullName, otp);
    }

    return res.status(HttpStatus.CREATED.code).json(new ApiResponse(HttpStatus.CREATED.code, otpKey, "OTP sent successfully. Please verify to complete signup.",
    ))
  } catch (error) {
    console.log(`Error while user sign up: ${error}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while user sign up"));
  }
}

const verifySignupOTP = async (req, res) => {
  try {
    const { otpKey, otp } = req.body;

    const storedData = await getData(otpKey);
    if (!storedData) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid or expired OTP"));
    }

    const storedOTP = Number(storedData?.otp);
    const userDetails = storedData?.userDetails;
    userDetails.isVerified = true;

    if (storedOTP !== otp) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid OTP"));
    }

    const newUser = await User.create(userDetails);
    const createdUser = await User.findById(newUser._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Something went wrong while registering the user.");
    }

    await deleteData(otpKey);

    return res.status(HttpStatus.CREATED.code).json(new ApiResponse(HttpStatus.CREATED.code, createdUser, "User registered Successfully"));
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ message: "An error occurred while verifying OTP." });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Email and Password are required."));
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "User doesn't exist"));
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
      .json(new ApiResponse(HttpStatus.OK.code, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully"));
  } catch (error) {
    console.error(`Error while logging in user: ${error.message}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while logging in user", error.message));
  }
}

const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $unset: {
          refreshToken: 1
        }
      },
      {
        new: true
      }
    )

    const options = {
      httpOnly: true,
      secure: true
    }

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged Out"));
  } catch (error) {
    console.error(`Error while logout user: ${error.message}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while logout user", error.message));
  }
}

const updateUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(new ApiError(HttpStatus.NOT_FOUND.code, "User not found."));
    }

    if (updates.email && updates.email !== user.email) {
      const existingEmail = await User.findOne({ email: updates.email });
      if (existingEmail) {
        return res
          .status(HttpStatus.BAD_REQUEST.code)
          .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Email already in use."));
      }
      user.email = updates.email;
    }

    if (updates.phone && updates.phone !== user.phone) {
      const existingPhone = await User.findOne({ phone: updates.phone });
      if (existingPhone) {
        return res
          .status(HttpStatus.BAD_REQUEST.code)
          .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Phone number already in use."));
      }
      user.phone = updates.phone;
    }

    Object.keys(updates).forEach((key) => {
      if (["fullName", "avatar", "address"].includes(key)) {
        user[key] = updates[key];
      }
    });

    await user.save();

    const updatedUser = await User.findById(userId).select("-password -refreshToken");

    res
      .status(HttpStatus.OK.code)
      .json(new ApiResponse(HttpStatus.OK.code, updatedUser, "User updated successfully."));
  } catch (error) {
    console.error("Update User Error:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "An error occurred while updating user."));
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Email is required"));
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "User not found"));
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.FRONTEND_URL}/resetPassword?token=${resetToken}`;
    await sendResetPasswordEmail(user.email, user.fullName, resetURL);

    return res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, {}, "Password reset link sent to email"));
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while requesting password change", error.message));
  }
};

const verifyOTPAndChangePassword = async (req, res) => {
  try {
    const { token, newPassword, confirmNewPassword } = req.body;

    if (newPassword !== confirmNewPassword) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ApiError(HttpStatus.BAD_REQUEST.code, "Passwords do not match")
      );
    }

    const user = await User.findOne({
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid or expired token")
      );
    }
    console.log("received: ", token);
    const isMatch = await bcrypt.compare(token, user.resetPasswordToken);
    if (!isMatch) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid token"));
    }


    user.password = newPassword;
    user.resetPasswordToken = "";
    user.resetPasswordExpires = "";
    await user.save();

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, {}, "Password changed successfully")
    );
  } catch (error) {
    console.error("Error in verifyOTPAndChangePassword:", error.message);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while verifying OTP", error.message)
    );
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "user",
          as: "orders"
        }
      },
      {
        $unwind: {
          path: "$orders",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: "$orders.orderItems",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "orders.orderItems.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $sort: { "orders.updatedAt": -1 } // Sort orders by updatedAt in descending order (latest first)
      },
      {
        $group: {
          _id: {
            userId: "$_id",
            orderId: "$orders._id"
          },
          fullName: { $first: "$fullName" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          role: { $first: "$role" },
          orderId: { $first: "$orders._id" },
          orderStatus: { $first: "$orders.orderStatus" },
          paymentStatus: { $first: "$orders.paymentStatus" },
          totalAmount: { $first: "$orders.totalAmount" },
          updatedAt: { $first: "$orders.updatedAt" }, // Include the updatedAt field in the group stage
          shippingAddress: { $first: "$orders.shippingAddress" }, // Include shipping address
          products: {
            $push: {
              productId: "$productDetails._id",
              productName: "$productDetails.product_name",
              price: "$productDetails.price",
              orderedQuantity: "$orders.orderItems.quantity",
              productTotal: {
                $multiply: ["$orders.orderItems.quantity", "$productDetails.price"]
              }
            }
          }
        }
      },
      {
        $group: {
          _id: "$_id.userId",
          fullName: { $first: "$fullName" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          role: { $first: "$role" },
          orders: {
            $push: {
              orderId: "$orderId",
              totalAmount: "$totalAmount",
              orderStatus: "$orderStatus",
              paymentStatus: "$paymentStatus",
              updatedAt: "$updatedAt",
              shippingAddress: "$shippingAddress", // Include shipping address in orders
              products: "$products"
            }
          }
        }
      },
      {
        $project: {
          password: 0,
          refreshToken: 0
        }
      }
    ]);

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, users, "Users fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error fetching users")
    );
  }
};


const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(userId) }
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "user",
          as: "orders"
        }
      },
      {
        $unwind: {
          path: "$orders",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: "$orders.orderItems",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "orders.orderItems.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            userId: "$_id",
            orderId: "$orders._id"
          },
          fullName: { $first: "$fullName" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          role: { $first: "$role" },
          orderId: { $first: "$orders._id" },
          orderStatus: { $first: "$orders.orderStatus" },
          paymentStatus: { $first: "$orders.paymentStatus" },
          totalAmount: { $first: "$orders.totalAmount" },
          products: {
            $push: {
              productId: "$productDetails._id",
              productName: "$productDetails.product_name",
              price: "$productDetails.price",
              orderedQuantity: "$orders.orderItems.quantity",
              productTotal: {
                $multiply: ["$orders.orderItems.quantity", "$productDetails.price"]
              }
            }
          }
        }
      },
      {
        $group: {
          _id: "$_id.userId",
          fullName: { $first: "$fullName" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          role: { $first: "$role" },
          orders: {
            $push: {
              orderId: "$orderId",
              totalAmount: "$totalAmount",
              orderStatus: "$orderStatus",
              paymentStatus: "$paymentStatus",
              products: "$products"
            }
          }
        }
      },
      {
        $project: {
          password: 0,
          refreshToken: 0
        }
      }
    ]);

    if (!user.length) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ApiError(HttpStatus.NOT_FOUND.code, "User not found")
      );
    }

    return res.status(HttpStatus.OK.code).json(
      new ApiResponse(HttpStatus.OK.code, user[0], "User fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error fetching user")
    );
  }
};

const deactivateUser = async (req, res) => {
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
export { registerUser, verifySignupOTP, loginUser, logout, updateUser, forgotPassword, verifyOTPAndChangePassword, getAllUsers, deactivateUser, getUserById }