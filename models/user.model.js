const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const UserDetail = new Schema({
    username: String,
    password: String,
    email: String, 
    wigle: String,
    pwnagotchi: String, 
    pfp: String
});

module.exports = UserDetail;