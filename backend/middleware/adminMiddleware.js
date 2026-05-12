const authMiddleware = require("./authMiddleware");
const roleMiddleware = require("./roleMiddleware");

/** Admin-only stack: authenticate then require role admin. */
module.exports = [authMiddleware, roleMiddleware("admin")];
