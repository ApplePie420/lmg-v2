// hiding away, i don't know now, where to hide...
require('dotenv-flow').config({
    path: '../.env',
});
const mongoURI = process.env.MONGOURL;

// auth, session
const connectEnsureLogin = require('connect-ensure-login');
const {v4: uuidv4} = require('uuid');

// GridFS
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const grid = require('gridfs-stream');

// database
const mongoose = require('mongoose');
const MongoClient = require('mongodb').MongoClient;
const UserDetail = require('../models/user.model');

// instantiate user model
const UserDetails = mongoose.model('userInfo', UserDetail, 'userInfo');

// default error route and message
const errorRoute = '/error?err=You must be logged in';

// create GridFS bucket...
/*
    TODO: rework this
    ? Possible bug
    idk why, but I can't create gridFS bucket inside existing function,
    so I have to open the DB two times, one only for creating bucket,
    second for everything else.. idk this is retarded
*/
const tempConn = mongoose.createConnection(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

let gfs;
tempConn.once('open', () => {
    gfs = grid(tempConn.db, mongoose.mongo);
    gfs.collection('uploads');
});

// create gridfs storage
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const filename = file.originalname;
            const fileInfo = {
                filename: filename,
                bucketName: 'uploads',
            };
            resolve(fileInfo);
        });
    },
});

const upload = multer({
    storage,
});

module.exports = function(app) {
    /*
     * Changes user details in DB.
     */
    app.post('/saveUserDetails', connectEnsureLogin.ensureLoggedIn(errorRoute),
        (req, res) => {
            try {
                // change password hash and salt, it have to be done by
                // this because hashing and salt generation shit
                UserDetails.findByUsername(req.body.username)
                    .then(function(sanitizedUser) {
                        if (sanitizedUser) {
                            sanitizedUser.setPassword(req.body.password,
                                function() {
                                    sanitizedUser.save();
                                });
                        } else {
                            res.status(500).json({
                                message: 'this user does not exist',
                            });
                        }
                    }, function(err) {
                        console.error(err);
                    });

                MongoClient.connect(mongoURI, function(err, db) {
                    // display error message and throw err
                    if (err) {
                        res.redirect('/error?err=' + err.toString());
                        throw err;
                    }

                    const dbo = db.db('lmg-db');

                    dbo.collection('userInfo').updateOne({
                        username: req.body.username,
                    }, {
                        $set: {
                            username: req.body.username,
                            email: req.body.email,
                            wigle: req.body.wigle,
                            pwnagotchi: req.body.pwnagotchi,
                            marker_color: req.body.markerColor,
                        },
                    }, function(err, res) {
                        // display error message and throw err
                        if (err) {
                            res.redirect('/error?err=' + err.toString());
                            throw err;
                        }
                    });

                    dbo.collection('userColors').updateOne({
                        username: req.body.username,
                    }, {
                        $set: {
                            marker_color: req.body.markerColor,
                        },
                    }, function(err, res) {
                        // display error message and throw err
                        if (err) {
                            res.redirect('/error?err=' + err.toString());
                            throw err;
                        }
                    });
                });
            } catch (error) {
                console.log(error);
            }
            res.redirect('/user?info=Succesfully updated');
        });

    /*
    @API call
    TODO: Actually get info from DB and return that
    * Return details about user
    */
    app.get('/api/userInfo', connectEnsureLogin.ensureLoggedIn(errorRoute),
        (req, res) => {
            res.send({
                user: req.user,
            });
        });

    /*
     * Profile picture upload
     */
    app.post('/pfpUpload', upload.single('pfp'),
        connectEnsureLogin.ensureLoggedIn(errorRoute), (req, res) => {
            MongoClient.connect(mongoURI, function(err, db) {
                // display error message and throw err
                if (err) {
                    res.redirect('/error?err=' + err.toString());
                    throw err;
                }

                const dbo = db.db('lmg-db');

                dbo.collection('userInfo').updateOne({
                    username: req.user.username,
                }, {
                    $set: {
                        pfp: req.file.filename,
                    },
                }, function(err, res) {
                    // display error message and throw err
                    if (err) {
                        res.redirect('/error?err=' + err.toString());
                        throw err;
                    }
                });
            });
            res.redirect('/user');
        });

    /*
     * Retrieve image back
     */
    app.get('/image/:filename', (req, res) => {
        gfs.files.findOne({
            filename: req.params.filename,
        }, (err, file) => {
            // display error message and throw err
            if (err) {
                res.redirect('/error?err=' + err.toString());
                throw err;
            }
            // Check if the input is a valid image or not
            if (!file || file.length === 0) {
                return res.status(404).json({
                    err: 'No file exists',
                });
            }

            // If the file exists then check whether it is an image
            if (file.contentType === 'image/jpeg' ||
                file.contentType === 'image/png' ||
                file.contentType === 'image/gif') {
                // Read output to browser
                const readstream = gfs.createReadStream(file.filename);
                readstream.pipe(res);
            } else {
                res.status(404).json({
                    err: 'Not an image',
                });
            }
        });
    });

    /*
    * Geenrate unique api key (UUID) for the user
    */
    app.post('/generateApiKey', connectEnsureLogin.ensureLoggedIn(errorRoute),
        (req, res) => {
            console.log(req.user.username);
            try {
                MongoClient.connect(mongoURI, function(err, db) {
                    // display error message and throw err
                    if (err) {
                        res.redirect('/error?err=' + err.toString());
                        throw err;
                    }

                    const dbo = db.db('lmg-db');

                    dbo.collection('userInfo').updateOne({
                        username: req.user.username,
                    }, {
                        $set: {
                            apiKey: uuidv4(),
                        },
                    }, function(err, res) {
                        // display error message and throw err
                        if (err) {
                            res.redirect('/error?err=' + err.toString());
                            throw err;
                        }
                    });
                });
            } catch (Error) {
                throw new Error;
                console.log(Error);
            }
            res.redirect('/user?info=Key generated.');
        });
};
