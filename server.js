// .env configs, so you can't see my db API and passwords :P
require("dotenv").config();

// routing
const express = require("express");

// cors
const cors = require("cors");

// http parsing
const bodyParser = require("body-parser");
const cookie_parser = require("cookie-parser");

// system related
const path = require("path");

// auth and session
const expressSession = require("express-session")({
  secret: process.env.EXPRESS_SECRET,
  resave: true,
  saveUninitialized: false,
  maxAge: Date.now() + (30 * 86400 * 1000)
});
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose");
const connectEnsureLogin = require("connect-ensure-login");
const apiHeaderKey = require("passport-headerapikey");

// database
const mongoose = require("mongoose");
const MongoClient = require("mongodb").MongoClient;

// misc
const stringify = require("js-stringify");
const moment = require("moment");
const crypto = require("crypto");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");

const UserDetail = require("./models/user.model");
const { resolve } = require("path");
const { rejects } = require("assert");
const cookieParser = require("cookie-parser");
const { session } = require("passport");
const { type } = require("os");

// init express app
const app = express();

// cors options
var corsOptions = {
  origin: "http://localhost:8081"
};
app.use(cors(corsOptions));

// parsng Http body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cookieParser());

// for serving files
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// passport and sessions
app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
  if(req.user) req.user.pfp = req.user.pfp;
  next();
});

// use momentJS for manipulating time
app.locals.moment = require("moment");

// mongoDB URL
const mongoURI = process.env.MONGOURL;

// create GridFS bucket...
/*
  TODO: rework this
  ? Possible bug
  idk why, but I can't create gridFS bucket inside existing function, so I have to open the DB two times, one only for creating bucket,
  second for everything else.. idk this is retarded
*/
var tempConn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let gfs;
tempConn.once("open", () => {
  gfs = Grid(tempConn.db, mongoose.mongo);
  gfs.collection("uploads");
})

//connect to db
const dbConn = mongoose.connect(mongoURI,
 {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// create gridfs storage
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
        const filename = file.originalname;
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
    });
  }
});

const upload = multer({
  storage
});

// middleware config
UserDetail.plugin(passportLocalMongoose);
const UserDetails = mongoose.model("userInfo", UserDetail, "userInfo");

passport.use(UserDetails.createStrategy());
passport.serializeUser(UserDetails.serializeUser());
passport.deserializeUser(UserDetails.deserializeUser());

passport.use(new apiHeaderKey.HeaderAPIKeyStrategy(
  { header: "Authorization" },
  false,
  function(apikey, done) {
    
    UserDetails.findOne({apikey: apikey}, function(err, user) {
      
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      
      passport.authenticate("local");
      return done(null, user);
    });
  }
));

/*
 * ROUTER REWORKED V2.0
 ! AUTHENTICATION SECTION
*/

/*
  Login post. Should concatc mongoDB and authenticate the user. Redirects to /user, if error, redirects to / with error message
*/
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

/*
  Same as login, but with API key for authenticating third-party apps.
*/
app.post("/api/mobapp/authAPI", passport.authenticate("headerapikey", {session: false, failureRedirect: "/?err=Invalid API key"}), function(req, res) {
  req.logIn(req.user, function(err) {
    if (err) { return next(err); }

    return res.send("Authenticated");
  });
});

/*
  Creates a new user based on user model, inserts into db. Password is automatically hashed and salted.
*/
app.post("/registerUser", connectEnsureLogin.ensureLoggedIn("/?info=Only registered users can invite others"), (req, res, next) => {
  try {
    UserDetails.register({
      username: req.body.username,
      active: false
    }, req.body.password, req.body.email);
    var dbo = db.db("lmg-db");

    dbo.collection("userColors").insertOne({username: req.body.username}, function(err, res) {
      if (err) throw err;
    });
    res.redirect(`/?info=User ${req.body.username} sucesfully registered`);
  } catch (error) {
    next(error);
  }
});

/*
  Destroys session and log out the user.
*/
app.get("/logout", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  req.logOut();
  res.redirect("/?info=User logged out succesfully");
});

/*
  ! User details routes
*/

/*
  Changes user details in DB. 
*/
app.post("/saveUserDetails", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  try {
    // change password hash and salt, it have to be done by this because hashing and salt generation shit
    UserDetails.findByUsername(req.body.username).then(function(sanitizedUser) {
      if(sanitizedUser) {
        sanitizedUser.setPassword(req.body.password, function() {
          sanitizedUser.save();
        });
      } else {
        res.status(500).json({message: "this user does not exist"});
      }
      }, function(err) {
        console.error(err);
    });

    var connection = MongoClient.connect(mongoURI, function(err, db) {
      if (err) throw err;

      var dbo = db.db("lmg-db");

      dbo.collection("userInfo").updateOne({username: req.body.username}, {$set: 
        {
          username: req.body.username,
          email: req.body.email,
          wigle: req.body.wigle,
          pwnagotchi: req.body.pwnagotchi,
          marker_color: req.body.markerColor
        }}, function(err, res) {
        if (err) throw err;
      });

      dbo.collection("userColors").updateOne({username: req.body.username}, {$set: 
        {
          marker_color: req.body.markerColor
        }}, function(err, res) {
        if (err) throw err;
      });
    });
  } catch (error) {
    console.log(error);
  }
  res.redirect("/user?info=Succesfully updated");
});

/*
  @API call
  TODO: Actually get info from DB and return that
  Return details about user
*/
app.get("/api/userInfo", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  res.send({
    user: req.user
  });
});

/*
  Profile picture upload
*/
app.post("/pfpUpload", upload.single("pfp"), connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  MongoClient.connect(mongoURI, function(err, db) {
    if (err) throw err;

    var dbo = db.db("lmg-db");

    dbo.collection("userInfo").updateOne({username: req.user.username}, {$set: 
      {
        pfp: req.file.filename
      }}, function(err, res) {
      if (err) throw err;
    });
  });
  res.redirect("/user");
});

/*
  Retrieve image back
*/
app.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if the input is a valid image or not
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    // If the file exists then check whether it is an image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === "image/gif") {
      // Read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
});

/*
  ! API routes
*/

/*
  @API call
  Calling this function while logged in returns a md5 hash of whole database
*/
app.get("/api/mobapp/dbHash", passport.authenticate("headerapikey", {session: false, failureMessage: "Incorrect/missing API key"}), async (req, res) => {
  MongoClient.connect(mongoURI, async function (err, db) {
    if (err) throw err;
    var dbo = db.db("lmg-db");

    var hash = undefined;

   await dbo.collection("wifis").find().toArray().then(result => {
      if(err) throw err;

      //console.log(JSON.stringify(result));

      hash = crypto.createHash("md5").update(JSON.stringify(result)).digest("hex");

      res.send(hash);
    });

    db.close(); 
  });
});

/*
  @API call
  Calling this while logged in returns JSON object, which contains whole lmg-db.wifis collection
*/
app.get("/api/mobapp/getCollection", passport.authenticate("headerapikey", {session: false, failureMessage: "Incorrect/missing API key"}), async (req, res) => {
  MongoClient.connect(mongoURI, async function (err, db) {
    if (err) throw err;
    var dbo = db.db("lmg-db");

   await dbo.collection("wifis").find().toArray().then(result => {
      res.send(result);
    });

    db.close(); 
  });
});

// save shit to changelog collection
app.post("/api/changelog/saveChangelog", connectEnsureLogin.ensureLoggedIn("/?error=You don't have rights to do this."), (req, res) => {
  // split incoming text from textarea by newlines
  var newChanges = req.body.changesArea.split("\r\n");

  // add secret sauces
  var changesObject = {
    "timestamp": new Date().toLocaleString(),
    "changes": [
      ...newChanges // this is fucking cool, thanks ES6!
    ],
    "badges": [
                req.body.ui == "on" ? "ui" : "",
                req.body.ux == "on" ? "ux" : "",
                req.body.backend == "on" ? "backend" : "",
                req.body.database == "on" ? "database" : "",
                req.body.map == "on" ? "map" : "",
                req.body.user_system == "on" ? "user_system" : "",
                req.body.new_page == "on" ? "new_page" : ""]  // ... and this is retarded. Can't really use switch, so we going Yandere simulator style
  };
  //console.log(changesObject); //debug ting

  // write stuff to database
  MongoClient.connect(mongoURI, async function (err, db) {
    if (err) throw err;
    var dbo = db.db("lmg-db");

    dbo.collection("changelog").insertOne(changesObject, function(err, result){
      if(err) {
        // redirect with error message
        res.render("/user?error=" + err);
      }
    });
  });
  // redirect with success message
  res.redirect("/user?info=Changelog entry sucesfully created.");
});

/*
  ! Static routes
*/

// Home page
app.get("/", (req, res) => {
  res.render("index", {error: req.query.err, info: req.query.info});
});

// register page
app.get("/register", (req, res) => {
  res.render("register");
});

// map page
app.get("/map", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  // query wifi data and render the page

  MongoClient.connect(mongoURI, function (err, db) {
    if (err) throw err;
    var dbo = db.db("lmg-db");
    var counter = 0;
    var UPCcounter = 0;
    var counter = {"N3ttX": 0, "Czechball": 0, "Grapfield": 0, "Cvolton": 0, "Bodax": 0};
    dbo.collection("wifis").find().toArray(function (err, result) {
      if (err) throw err;

      var times = [];
      result.forEach(element => {
        if (element.author == "N3ttX") {
          counter["N3ttX"] += 1;
        }
        if (element.author == "Czechball") {
          counter["Czechball"] += 1;
        }
        if (element.author == "Cvolton") {
          counter["Cvolton"] += 1;
        }
        if (element.author == "Grapfield") {
          counter["Grapfield"] += 1;
        }
        if (element.author == "Bodax") {
          counter["Bodax"] += 1;
        }
        if (element.SSID.substring(0, 3) == "UPC") {
          UPCcounter += 1;
        }
        if (element.timestamp) {
          times.push(element.timestamp);
        }
      });

      // since leaflet got updated, it no longer supports not displaying null positions. So we need to filter them out.
      var filtered = result.filter(element => element.position[0] != "null");

      times.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });
      var lastDate = times[times.length - 1];

      db.close();
      //console.log(result);

      // and get colors 
      MongoClient.connect(mongoURI, function (err, db) {
        var dboo = db.db("lmg-db");
        dboo.collection("userColors").find().toArray(function (err, result) {
          if (err) throw err;
          res.render("wifi-map", {
            username: req.user.username,
            dbData: filtered,
            colors: result,
            stringify,
            foundByUser: counter,
            UPCcounter: UPCcounter,
            lastDate: lastDate,
            pfp: req.user.pfp
          });
        });
      });
    });
  });
});

// changelog creator
app.get("/manageChangelog", connectEnsureLogin.ensureLoggedIn("/?error=You have to be N3ttX to access this page"), (req, res) => {
  res.render("manageChangelog", {
    username: req.user.username,
    pfp: req.user.pfp,
  });
});

// user profile page
app.get("/user", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  res.render("userProfile", {
    username: req.user.username,
    pfp: req.user.pfp,
    error: req.query.err, 
    info: req.query.info
  });
});

// edit user page
app.get("/editUser", connectEnsureLogin.ensureLoggedIn("/"), (req, res) =>{
  // get already used marker colors so we can disable them
  MongoClient.connect(mongoURI, function (err, db) {
    var dboo = db.db("lmg-db");
    dboo.collection("userColors").find().toArray(function (err, result) {
      // array of used colors
      var usedMarkerColors = [];

      result.forEach(element => {
        usedMarkerColors.push(element.marker_color);
      });

      // render the page
      res.render("editUser", {
        username: req.user.username,
        userMail: req.user.email,
        pfp: req.user.pfp,
        pwnagotchi: req.user.pwnagotchi,
        markerColor: req.user.marker_color,
        usedMarkers: usedMarkerColors
      });
    });
  });
});

// changelog route page
app.get("/changelog", (req, res) => {
  var changelogQuery;
  MongoClient.connect(mongoURI, function (err, db) {
    if (err) throw err;
    var dbo = db.db("lmg-db");
    dbo.collection("changelog").find().toArray(function (err, result) {
      changelogQuery = result;
      //console.log(changelogQuery[0]);
      res.render("changelog", {
        changelog: changelogQuery,
        stringify
      });
    });
  });
});

// TODO: rework this
// pfp change route
app.get("/changePFP", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
  res.render("changePFP", {
    username: req.user.username,
    pfp: req.user.pfp
  });
});

/*
  ! Server startup settings
*/
//set port, listen for requests
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});