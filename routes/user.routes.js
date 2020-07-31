const {authJwt} = require("../middleware");
const controller = require("../controllers/user.controller");

module.exports = function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept",
            "Access-Control-Expose-Headers", "username"
        );
        next();
    });

    app.get('/api/content/all', controller.allAccess);

    app.get("/api/content/user", [authJwt.verifyToken], controller.userBoard);

    app.get(
        "/api/content/admin",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.adminBoard
    );
};