// peekaboo
require("dotenv").config({
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
            if (err) throw err;
            var dbo = db.db("lmg-db");

            var hash = undefined;

            await dbo.collection("wifis").find().toArray().then(result => {
                if (err) throw err;

                //console.log(JSON.stringify(result));

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
            if (err) throw err;
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
            if (err) throw err;
            var dbo = db.db("lmg-db");

            dbo.collection("changelog").insertOne(changesObject, function (err, result) {
                if (err) {
                    // redirect with error message
                    res.render("/user?error=" + err);
                }
            });
        });
        // redirect with success message
        res.redirect("/user?info=Changelog entry sucesfully created.");
    });
}