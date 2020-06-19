const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dbConfig = require("./config/db.config");
const path = require("path");

// init express app
const app = express();

// cors options
var corsOptions = {
    origin: "http://localhost:8081"
};

// use express middleware
app.use(cors(corsOptions));

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({extended: true}));

app.use(express.static(path.join(__dirname, "public")));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// database related
const db = require("./models");
const Role = db.role;

//connect to db
db.mongoose.connect("mongodb+srv://admin:KawX22GgfxtZVxm@n3ttx-cluster-chyxb.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Succesfully connected to mongoDB");
    initial();
}).catch(err => {
    console.error("Connection error", err);
    process.exit();
});

// simple route
app.get("/", (req, res) => {
    res.render("index", {title: "Home"});
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/changelog", (req, res) =>{
  res.render("changelog");
});

// routes
require("./routes/auth.routes")(app);
require("./routes/user.routes")(app);

//set port, listen for requests
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

function initial() {
    Role.estimatedDocumentCount((err, count) => {
      if (!err && count === 0) {
        new Role({
          name: "user"
        }).save(err => {
          if (err) {
            console.log("error", err);
          }
  
          console.log("added 'user' to roles collection");
        });
  
        new Role({
          name: "admin"
        }).save(err => {
          if (err) {
            console.log("error", err);
          }
  
          console.log("added 'admin' to roles collection");
        });
      }
    });
}