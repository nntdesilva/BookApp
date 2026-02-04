/**
 * Passport Configuration
 * Configures passport with local strategy using passport-local-mongoose
 */

const passport = require("passport");
const User = require("../models/User");

/**
 * Use the built-in authentication strategy from passport-local-mongoose
 */
passport.use(User.createStrategy());

/**
 * Use the built-in serialization/deserialization from passport-local-mongoose
 */
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

module.exports = passport;
