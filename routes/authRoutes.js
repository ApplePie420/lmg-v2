// session and auth
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");

//auth
const mongoose = require("mongoose");
const UserDetail = require("../models/user.model");

// instantiate user model
const UserDetails = mongoose.model("userInfo", UserDetail, "userInfo");

module.exports = function (app) {
    /*
     * Login post. Should concatc mongoDB and authenticate the user. Redirects to /user, if error, redirects to / with error message
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
                return res.redirect("/?err=" + info.message);
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
     * Same as login, but with API key for authenticating third-party apps.
     */
    app.post("/api/mobapp/authAPI", passport.authenticate("headerapikey", {
        session: false,
        failureRedirect: "/?err=Invalid API key"
    }), function (req, res) {
        req.logIn(req.user, function (err) {
            if (err) {
                return next(err);
            }

            return res.send("Authenticated");
        });
    });

    /*
     * Creates a new user based on user model, inserts into db. Password is automatically hashed and salted.
     */
    app.post("/registerUser", connectEnsureLogin.ensureLoggedIn("/?info=Only registered users can invite others"), (req, res, next) => {
        try {
            UserDetails.register({
                username: req.body.username,
                active: false
            }, req.body.password, req.body.email);
            //FIXME: connect to database and set color
            // var dbo = db.db("lmg-db");

            // dbo.collection("userColors").insertOne({username: req.body.username}, function(err, res) {
            //   if (err) throw err;
            // });
            res.redirect(`/?info=User ${req.body.username} sucesfully registered`);
        } catch (error) {
            next(error);
        }
    });

    /*
     * Destroys session and log out the user.
     */
    app.get("/logout", connectEnsureLogin.ensureLoggedIn("/"), (req, res) => {
        req.logOut();
        res.redirect("/?info=User logged out succesfully");
    });
}