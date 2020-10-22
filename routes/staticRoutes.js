// so i can hide my secrety secrets from you
require("dotenv").config({
    path: "../.env"
});
const mongoURI = process.env.MONGOURL;

// parsing JSON shit in pug
const stringify = require("js-stringify");

// auth, session and database
const connectEnsureLogin = require("connect-ensure-login");
const MongoClient = require("mongodb").MongoClient;

module.exports = function (app) {
    /*
     * Home page
     */
    app.get("/", (req, res) => {
        res.render("index", {
            error: req.query.err,
            info: req.query.info
        });
    });

    /*
     * register page
     */
    app.get("/register", (req, res) => {
        res.render("register");
    });

    /*
     * Map page
     */
    app.get("/map", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
        // query wifi data and render the page
        MongoClient.connect(mongoURI, function (err, db) {
            if (err) throw err;
            var dbo = db.db("lmg-db");
            var counter = 0;
            var UPCcounter = 0;

            // TODO: make this counting system automatic based on registered users
            var counter = {
                "N3ttX": 0,
                "Czechball": 0,
                "Grapfield": 0,
                "Cvolton": 0,
                "Bodax": 0
            };
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

    /*
     * Changelog creator
     */
    app.get("/manageChangelog", connectEnsureLogin.ensureLoggedIn("/?error=You have to be N3ttX to access this page"), (req, res) => {
        res.render("manageChangelog", {
            username: req.user.username,
            pfp: req.user.pfp,
        });
    });

    /*
     * user profile page
     */
    app.get("/user", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
        res.render("userProfile", {
            username: req.user.username,
            pfp: req.user.pfp,
            error: req.query.err,
            info: req.query.info
        });
    });

    /*
     * edit user page
     */
    app.get("/editUser", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
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

    /*
     * changelog route page
     */
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


    /*
     * pfp change route
     */
    // TODO: rework this somehow, idk why even
    app.get("/changePFP", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
        res.render("changePFP", {
            username: req.user.username,
            pfp: req.user.pfp
        });
    });
}