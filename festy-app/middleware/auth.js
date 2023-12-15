"use strict";

/** Convenience middleware to handle common auth cases in routes. */

const { UnauthorizedError } = require("../expressError");


/** Middleware to use when they must be logged in.
 *
 * If not, raises Unauthorized.
 */

function ensureLoggedIn(req, res, next) {
  if (res.locals.user?.username) return next();
  throw new UnauthorizedError();
}



module.exports = {
  ensureLoggedIn,
};
