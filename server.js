const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const expressSession = require("express-session")({
  secret: "secret",
  resave: false,
  saveUninitialized: false,
  maxAge: Date.now() + (30 * 86400 * 1000)
});
const mongoose = require("mongoose");
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose");
const connectEnsureLogin = require("connect-ensure-login");
const MongoClient = require("mongodb").MongoClient;
const stringify = require("js-stringify");
const moment = require("moment");

const UserDetail = require("./models/user.model");

// init express app
const app = express();

// cors options
var corsOptions = {
  origin: "http://localhost:8081"
};

// use express middleware
// CORS
app.use(cors(corsOptions));

// parsng Http body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// for serving files
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// passport and sessions
app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());

app.locals.moment = require("moment");

//connect to db
mongoose.connect("mongodb+srv://admin:KawX22GgfxtZVxm@n3ttx-cluster-chyxb.mongodb.net/lmg-db", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

UserDetail.plugin(passportLocalMongoose);
const UserDetails = mongoose.model("userInfo", UserDetail, "userInfo");

passport.use(UserDetails.createStrategy());
passport.serializeUser(UserDetails.serializeUser());
passport.deserializeUser(UserDetails.deserializeUser());

// routes reworked
// handle login, post request
// this shall try to authenticate user, if not, return to login page with error message
app.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successReturnToOrRedirect: "/",
    failureRedirect: "/?err=Something went wrong",
    failureFlash: true
  }, (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.redirect("/?err=" + info);
    }

    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }

      return res.redirect("/user");
    });
  })(req, res, next);
});

// register a new user
app.post("/registerUser", (req, res, next) => {
  try {
    UserDetails.register({
      username: req.body.username,
      active: false
    }, req.body.password, req.body.email);
    res.redirect(`/?info=User ${req.body.username} sucesfully registered`);
  } catch (error) {
    next(error);
  }
});

// logout
app.get("/logout", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  req.logOut();
  res.redirect("/");
});

// main page
app.get("/", (req, res) => {
  res.render("index");
});

// register page
app.get("/register", (req, res) => {
  res.render("register");
});

// map page
app.get("/map", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  // query wifi data and render the page
  var url = "mongodb+srv://admin:KawX22GgfxtZVxm@n3ttx-cluster-chyxb.mongodb.net/lmg-db?retryWrites=true&w=majority";

  MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("lmg-db");
    var counter = 0;
    var UPCcounter = 0;
    dbo.collection("wifis").find().toArray(function (err, result) {
      if (err) throw err;

      var times = [];
      result.forEach(element => {
        if (element.author == "N3ttX") {
          counter += 1;
        }
        if (element.SSID.substring(0, 3) == "UPC") {
          UPCcounter += 1;
        }
        if (element.timestamp) {
          times.push(element.timestamp);
        }

      });

      times.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });
      var lastDate = times[times.length - 1];
      //console.log(times[times.length-1]);

      db.close();
      res.render("wifi-map", {
        username: req.user.username,
        dbData: result,
        stringify,
        nettFound: counter,
        UPCcounter: UPCcounter,
        lastDate: lastDate
      });
    });
  });
});

// user profile page
app.get("/user", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  res.render("userProfile", {
    username: req.user.username
  });
});

// API call for getting user info
// TODO: call this with user credentials in payload
app.get("/userInfo", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  res.send({
    user: req.user
  });
});

//TODO: create API responses for mobile app

// changelog route page
app.get("/changelog", (req, res) => {
  res.render("changelog");
});

//set port, listen for requests
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});