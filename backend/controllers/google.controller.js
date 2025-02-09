import passport from "../services/google.service.js";
import { User } from "../models/user.model.js";
import { HttpStatus } from "../constants/status.code.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

export const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

export const googleCallback = (req, res) => {
  passport.authenticate("google", { session: false }, async (err, data) => {
    if (err || !data) {
      console.error("Google Authentication Error:", err);
      return res.status(HttpStatus.UNAUTHORIZED.code).json(new ApiError(HttpStatus.UNAUTHORIZED.code, "Authentication failed"));
    }

    const { user, accessToken, refreshToken } = data;

    await User.findOneAndUpdate(
      { googleId: user.googleId },
      { accessToken, refreshToken },
      { upsert: true }
    );

    const options = {
      httpOnly: true,
      secure: true
    };

    res.cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options);

    const frontendUrl = process.env.FRONTEND_URL;
    return res.redirect(frontendUrl);
  })(req, res);
};
