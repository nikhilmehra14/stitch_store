import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import {User} from '../models/user.model.js';
import { generateAccessAndRefreshTokens } from '../controllers/user.controller.js';
import dotenv from "dotenv";
dotenv.config();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
},
async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
	
    if (!user) {
      user = await User.findOne({ email: profile.emails[0].value });
      
      if (user) {
        user.googleId = profile.id;
        user.avatar = profile.photos[0]?.value;
        await user.save();
      } else {
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          fullName: profile.displayName,
          avatar: profile.photos[0]?.value,
          role: 'customer',
        });
      }
    }

    const tokens = await generateAccessAndRefreshTokens(user._id);
    return done(null, { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (error) {
    return done(error, false);
  }
}
));
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
