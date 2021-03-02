// peekaboo
require("dotenv-flow").config({
    path: "../.env"
});
const mongoURI = process.env.MONGOURL;

//  auth and session
const passport = require("passport")
const connectEnsureLogin = require("connect-ensure-login");

//database
const MongoClient = require("mongodb").MongoClient;

// hashing funciton
const crypto = require("crypto");

module.exports = function (app) {
    /*
        @API call
        * Calling this function while logged in returns a md5 hash of whole database
        Used mainly for the mobile app
    */
    app.get("/api/mobapp/dbHash", passport.authenticate("headerapikey", {
        session: false,
        failureMessage: "Incorrect/missing API key"
    }), async (req, res) => {
        MongoClient.connect(mongoURI, async function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dbo = db.db("lmg-db");
            var hash = undefined;

            await dbo.collection("wifis").find().toArray().then(result => {
                // display error message and throw err
                if (err) {
                    res.redirect("/error?err=" + err.toString());
                    throw err;
                }

                hash = crypto.createHash("md5").update(JSON.stringify(result)).digest("hex");
                res.send(hash);
            });
            db.close();
        });
    });

    /*
        @API call
        * Calling this while logged in returns JSON object, which contains whole lmg-db.wifis collection
        Again, used mostly in the mobile app
    */
    app.get("/api/mobapp/getCollection", passport.authenticate("headerapikey", {
        session: false,
        failureMessage: "Incorrect/missing API key"
    }), async (req, res) => {
        MongoClient.connect(mongoURI, async function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dbo = db.db("lmg-db");

            await dbo.collection("wifis").find().toArray().then(result => {
                res.send(result);
            });

            db.close();
        });
    });

    /*
        @ API Call
        * Saves stuff from manageChangelog into database.
    */
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
                req.body.new_page == "on" ? "new_page" : ""
            ] // ... and this is retarded. Can't really use switch, so we going Yandere simulator style
        };
        //console.log(changesObject); //debug ting

        // write stuff to database
        MongoClient.connect(mongoURI, async function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dbo = db.db("lmg-db");

            dbo.collection("changelog").insertOne(changesObject, function (err, result) {
                // display error message and throw err
                if (err) {
                    res.redirect("/error?err=" + err.toString());
                    throw err;
                }
            });
        });
        // redirect with success message
        res.redirect("/user?info=Changelog entry sucesfully created.");
    });

    /*
        @ API Call
        * Returns "true" if wifi's nmap report exists
    */
    app.get("/nmapReportExists", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        // get the SSID
        // TODO: instead of SSID, make this based on MAC
        var xmlQuery = req.query.SSID;
        // query wifi info collection for SSID
        MongoClient.connect(mongoURI, function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dbo = db.db("lmg-db");
            dbo.collection("wifi-info").find({"SSID": xmlQuery}).toArray(function (err, result) {
                // send false if does not exists, otherwise send true lol
                if(result.length == 0) {
                    res.send("false");
                } else {
                    res.send("true")
                }
            });
        });
    });

    /*
        @ API Call
        * Returns JSON with SSIDs of available nmap reports
    */
    app.get("/nmapReportsList", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        // TODO: instead of SSID, make this based on MAC
        // query wifi info collection for SSID
        MongoClient.connect(mongoURI, function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dbo = db.db("lmg-db");
            dbo.collection("wifi-info").find({}).toArray(function (err, result) {
                // display error message and throw err
                if (err) {
                    res.redirect("/error?err=" + err.toString());
                    throw err;
                }
                // new array of available SSIDs, we don't want users to see our whole colelction
                var availableSSIDs = [];
                // push each SSID into the array
                result.forEach(ssid => {
                    availableSSIDs.push(ssid.SSID);
                });
                // send the array object
                res.send(availableSSIDs);
            });
        });  
    });

    /*
        @ API Call
        * Puts an XML file into the database. Provide following:
        - SSID and MAC in body
        - XML file as multipart/form-data in files
        A valid session has to be established, otherwise nothing will happen

        SSID and MAC is obviously taken from request body
        Filename, hash amd XML is extracted from file
        Author's name is taken from currently active session (e.g. you have to be logged in to upload)
        Timestamp is generated new
    */
    app.post("/api/uploadXML", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        // TODO: instead of SSID, make this based on MAC
        // construct database object from req
        var fileUploading = req.files.filename;
        var fileData = fileUploading.data;

        var dbEntry = {
            "SSID": req.body.SSID,
            "MAC": req.body.MAC,
            "filename": fileUploading.name,
            "hash": fileUploading.md5,
            "XML": fileData.toString("utf-8"),
            "dateUploaded": new Date().toLocaleString(),
            "author": req.user.username
        };

        // connecto to database
        MongoClient.connect(mongoURI, function (err, db) {
            // display error message and throw err
            if (err) {
                res.redirect("/error?err=" + err.toString());
                throw err;
            }
            var dbo = db.db("lmg-db");
            dbo.collection("wifi-info").insertOne(dbEntry, function (err, result) {
                // display error message and throw err
                if (err) {
                    res.redirect("/error?err=" + err.toString());
                    throw err;
                }
                
                // on succesfull entry, redirect to user page with info message
                res.redirect("/user?info=Nmap report succesfully added. Thank you");
            });
        });
    });

    /*
        @ API Call
        * Updates the WPS field
    */
    app.post("/api/editWPS", connectEnsureLogin.ensureLoggedIn("/error?err=You must be logged in"), (req, res) => {
        // create new input validator
        const { Validator } = require("node-input-validator");

        // set required MAC address and wps pin to be only number exactly 8 digits long
        const v = new Validator(req.body, {
            MAC: "required",
            wpspin: "required|integer|length:8,8"
        });

        // perform validation
        v.check().then((matched) => {
            if(!matched) {
                // throw error
                res.redirect("/editWPS?err=WPS PIN has to be 8 digits");
            } else {
                // connect to db
                MongoClient.connect(mongoURI, function (err, db) {
                    // display error message and throw err
                    if (err) {
                        res.redirect("/error?err=" + err.toString());
                        throw err;
                    }
                    var dbo = db.db("lmg-db");
                    dbo.collection("wifis").updateOne({
                        // find wifi with corresponding MAC
                        MAC: decodeURIComponent(req.body.MAC)
                    }, {
                            // set WPS pin to new value
                            $set: {
                                WPS: req.body.wpspin
                            }
                    }, function (err, res) {
                        // display error message and throw err
                        if (err) {
                            res.redirect("/error?err=" + err.toString());
                            throw err;
                        };
                        // redirect to map on succesfull entry
                        res.redirect("/map?info=WPS PIN Succesfully updated")
                    });
                });
            }
        });
    });
}