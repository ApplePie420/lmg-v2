const config = require("../config/auth.config");
const db = require("../models");
const User = db.user;
const Role = db.role;
const MongoClient = require("mongodb").MongoClient;
const stringify = require("js-stringify");

var url = "mongodb+srv://admin:KawX22GgfxtZVxm@n3ttx-cluster-chyxb.mongodb.net/lmg-db?retryWrites=true&w=majority";

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

exports.signup = (req, res) => {
    //console.log(req.body);
    const user = new User({
        username: req.body.username,
        email: req.body.email,
        password: bcrypt.hashSync(req.body.password, 8)
    });

    user.save((err, user) => {
        if(err) {
            res.status(500).send({message: err});
            return;
        }

        if(req.body.roles) {
            Role.find(
                {
                    name: {$in: req.body.roles}
                }, 
                (err, roles) => {
                    if(err) {
                        res.status(500).send({message: err});
                        return;
                    }

                    user.roles = roles.map(role => role._id);
                    user.save(err => {
                        if(err) {
                            res.status(500).send({message: err});
                            return;
                        }
                    })

                    res.send({message: "User was registered succesfully"});
                }
            );
        } else {
            Role.findOne({name: "user"}, (err, role) => {
                if(err) {
                    res.status(500).send({message: err});
                    return;
                }

                user.roles = [role._id];
                user.save(err => {
                    if(err) {
                        res.status(500).send({message: err});
                        return;
                    }

                    res.send({message: "User was registered succesfully"});
                });
            });
        }
    });
};

exports.signin = (req, res) => {
    User.findOne({
        username: req.body.username
    }).populate("roles", "-__v").exec((err, user) => {
        if(err) {
            res.status(500).send({message: err});
            return;
        }

        if(!user) {
            return res.status(404).send({message: "User not found"});
        }

        var passwordIsValid = bcrypt.compareSync(
            req.body.password,
            user.password
        );

        if(!passwordIsValid) {
            return res.status(401).send({
                accessTokken: null,
                message: "Invalid password!"
            });
        }

        var token = jwt.sign({id: user.id}, config.secret, {
            expiresIn: 86400
        });

        var authorities = [];

        for(let i = 0; i < user.roles.length; i++) {
            authorities.push("ROLE_" + user.roles[i].name.toUpperCase());
        }

        // connecto to db

        MongoClient.connect(url, function(err, db) {                   
            if(err) throw err;                                       
            var dbo = db.db("lmg-db");
            var counter = 0;
            var UPCcounter = 0;                           
            dbo.collection("wifis").find().toArray(function(err, result) {
                if(err) throw err;  
                
                result.forEach(element => {
                    if(element.author == "N3ttX") {
                        counter += 1;
                    }
                    if(element.SSID.substring(0,3) == "UPC") {
                        UPCcounter += 1;
                    }
                });

                db.close(); 
                res.render("userPage", {loggedIn: true, username: user.username, dbData: result, stringify, nettFound: counter, UPCcounter: UPCcounter});
            });
        });
    });
};