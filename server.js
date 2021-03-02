// .env configs, so you can't see my db API and passwords :P
require("dotenv-flow").config();

// routing
const express = require("express");

// cors
const cors = require("cors");

// http parsing
const bodyParser = require("body-parser");

// system related
const path = require("path");

// auth and session
const expressSession = require("express-session")({
  secret: process.env.EXPRESS_SECRET,
  resave: true,
  saveUninitialized: false,
  maxAge: Date.now() + (30 * 86400 * 1000)
});
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const apiHeaderKey = require("passport-headerapikey");

// database
const mongoose = require("mongoose");
const UserDetail = require("./models/user.model");
const cookieParser = require("cookie-parser");

// this really had to be done via fucking middleware.. like.. why
const favicon = require("serve-favicon");

const fileupload = require("express-fileupload");

// init express app
const app = express();

// cors options
var corsOptions = {
  origin: "http://localhost:8081"
};
app.use(cors(corsOptions));

app.use(fileupload());

// parsng http body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cookieParser());

// for serving files
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

// passport and sessions
app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());

// use momentJS for manipulating time
app.locals.moment = require("moment");

// middleware config
UserDetail.plugin(passportLocalMongoose);
const UserDetails = mongoose.model("userInfo", UserDetail, "userInfo");

// serialize user
passport.use(UserDetails.createStrategy());
passport.serializeUser(UserDetails.serializeUser());
passport.deserializeUser(UserDetails.deserializeUser());

// create API key strategy for passport
passport.use(new apiHeaderKey.HeaderAPIKeyStrategy({
    header: "Authorization"
  },
  false,
  function (apikey, done) {

    UserDetails.findOne({
      apikey: apikey
    }, function (err, user) {

      if (err) {
        return done(err);
      }
      if (!user) {
        return done(null, false);
      }

      passport.authenticate("local");
      return done(null, user);
    });
  }
));

// ! Load routes
require("./routes/apiRoutes")(app); // routes for API calls
require("./routes/authRoutes")(app); // routes for authenticating, registering and shit
require("./routes/userRoutes")(app); // routes for anything user-system related (edit info, get info, change pfp, ...)
require("./routes/staticRoutes")(app); // all of them static routes that you visit and are exposed

/*
  ! Server startup settings
*/
//set port, listen for requests
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});