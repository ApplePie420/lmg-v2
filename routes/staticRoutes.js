// so i can hide my secrety secrets from you
require("dotenv-flow").config({
    path: "../.env"
});
const mongoURI = process.env.MONGOURL;

// parsing JSON shit in pug
const stringify = require("js-stringify");

// auth, session and database
const connectEnsureLogin = require("connect-ensure-login");
const MongoClient = require("mongodb").MongoClient;

const { parseString, Parser } = require("xml2js");

module.exports = function (app) {
    /*
     * Home page
     */
    app.get("/", connectEnsureLogin.ensureLoggedOut("/user?err=You must log out."), (req, res) => {
        //TODO: Automatically log user out when is logged in and is visitind root page
        res.render("index", {
            error: req.query.err,
            info: req.query.info
        });
    });

    /*
     * register page
     */
    app.get("/register", connectEnsureLogin.ensureLoggedIn("/?info=This webpage is invite-only. Only already registered users can register new ones."), (req, res) => {
        res.render("register");
    });

    /*
     * Map page
     */
    app.get("/map", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        // query wifi data and render the page
        MongoClient.connect(mongoURI, function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
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
            dbo.collection("wifis").find().sort({SSID: 1}).toArray(function (err, result) {
                // display error message and throw err
                if (err) {
                    res.redirect("/error?err=" + err.toString());
                    throw err;
                }

                var times = [];
                // TODO: also make this automatic
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

                // and get colors 
                MongoClient.connect(mongoURI, function (err, db) {
                    // display error message and throw err
                    if (err) {
                        res.redirect("/error?err=" + err.toString());
                        throw err;
                    }
                    var dboo = db.db("lmg-db");
                    dboo.collection("userColors").find().toArray(function (err, result) {
                        if (err) throw err;

                        // this is retarded and probably highly unnecessary, but I needed somehow to create one array of objects
                        // which is basically the same as result from "userColors" but with found wifi number
                        // so I can sort them. There is no way of doing it other way (or at least nothing came to me with current implementation)
                        var newArray = [];
                        result.forEach(element => {
                            element["found"] = counter[element.username]
                            newArray.push(element); 
                        });

                        // sort the fcking array so user with most wifis is always on top
                        newArray.sort((a, b) => {return b.found - a.found});

                        // render the page
                        result.forEach(element => {})
                        res.render("wifi-map", {
                            username: req.user.username,
                            dbData: filtered,
                            usersFound: newArray,
                            stringify,
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
    app.get("/user", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        // get all changes from database, sorted by most recent
        MongoClient.connect(mongoURI, function (err, db) {
            var dboo = db.db("lmg-db");
            dboo.collection("changelog").find().sort({timestamp: -1}).toArray(function (err, result) {
                // display error message and throw err
                if (err) {
                    res.redirect("/error?err=" + err.toString());
                    throw err;
                }
                res.render("userProfile", {
                    stringify,
                    username: req.user.username,
                    pfp: req.user.pfp,
                    error: req.query.err,
                    info: req.query.info,
                    log: result[0]
                });
            });
        });
    });

    /*
     * edit user page
     */
    app.get("/editUser", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        // get already used marker colors so we can disable them
        MongoClient.connect(mongoURI, function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dboo = db.db("lmg-db");
            dboo.collection("userColors").find().toArray(function (err, result) {
                // display error message and throw err
                if (err) {
                    res.redirect("/error?err=" + err.toString());
                    throw err;
                }
                // array of used colors
                var usedMarkerColors = [];

                result.forEach(element => {
                    usedMarkerColors.push(element.marker_color);
                });

                // i forgot what this does
                var disableKey;
                if(req.user.apiKey != "") {
                    disableKey = false;
                } else {
                    disableKey = true;
                }

                // render the page
                res.render("editUser", {
                    username: req.user.username,
                    userMail: req.user.email,
                    pfp: req.user.pfp,
                    pwnagotchi: req.user.pwnagotchi,
                    markerColor: req.user.marker_color,
                    usedMarkers: usedMarkerColors,
                    apiKey: req.user.apiKey,
                    disableNewKey: disableKey
                });
            });
        });
    });

    /*
     * changelog route page
     */
    app.get("/changelog", (req, res) => {
        var changelogQuery;
        // query entire changelog collection
        MongoClient.connect(mongoURI, function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dbo = db.db("lmg-db");
            dbo.collection("changelog").find().sort({timestamp: -1}).toArray(function (err, result) {
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
    app.get("/changePFP", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        res.render("changePFP", {
            username: req.user.username,
            pfp: req.user.pfp
        });
    });

    /* 
    * generate Nmap recon report from database. SSID is URL parameter
    */
    app.get("/nmapReport", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        // get the SSID
        var xmlQuery = decodeURIComponent(req.query.SSID);
        // query wifi info collection for SSID
        MongoClient.connect(mongoURI, function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dbo = db.db("lmg-db");
            dbo.collection("wifi-info").find({"SSID": xmlQuery}).toArray(function (err, result) {
                // display error message and throw err
                if (err) {
                    res.redirect("/error?err=" + err.toString());
                    throw err;
                }
                // redirect if SSID is wrong
                if(result.length == 0) {
                    res.redirect("/error?err=SSID Not found");
                } else {
                    // get raw XML
                    var rawXML = result[0].XML;
                    
                    // parse XML to JSON
                    var parsedXML;
                    const parser = require("xml2js").parseString;
                    parseString(rawXML, function (err, res)  {
                        // display error message and throw err
                        if (err) {
                            res.redirect("/error?err=" + err.toString());
                            throw err;
                        }
                        parsedXML = res;
                    });

                    var foundBy = result[0].author;
                    var dateUploaded = result[0].dateUploaded;

                    // render the page
                    res.render("nmap_report", {
                        scan: parsedXML,
                        uploadedBy: foundBy,
                        timestamp: dateUploaded
                    });
                }
            });
        });
    });

    /* 
    * Upload nmap file form. Sends SSID and MAC in URI as query parameters
    */
    app.get("/uploadXML", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        res.render("uploadXML", {
            SSID: decodeURIComponent(req.query.SSID),
            MAC: req.query.MAC,
            stringify
        });
    });

    /* 
    * Renders error page with error in URL
    */
    app.get("/error", (req, res) => {
    res.render("error", {
        error: req.query.err
    });
});

    /*
    * FOR DEBUG PURPOSES
    app.get("/nmapRaw", (req, res) => {
        // get the SSID
        var xmlQuery = req.query.SSID;
        // query wifi info collection for SSID
        MongoClient.connect(mongoURI, function (err, db) {
            if (err) {
                throw err;
            }
            var dbo = db.db("lmg-db");
            dbo.collection("wifi-info").find({"SSID": xmlQuery}).toArray(function (err, result) {
                // redirect if SSID is wrong
                if(result.length == 0) {
                    res.redirect("/user?err=SSID Not found");
                } else {
                    // get raw XML
                    var rawXML = result[0].XML;
                    
                    // parse XML to JSON
                    var parsedXML;
                    const parser = require("xml2js").parseString;
                    parseString(rawXML, function (err, res)  {
                        parsedXML = res;
                    });

                    // send the raw JSON file
                    res.send(parsedXML);
                }
            });
        });
    });
    */
}