"use strict";

/** Express app for jobly. */

const express = require("express");
const cors = require("cors");

const { NotFoundError } = require("./expressError");

const { authenticateJWT } = require("./middleware/auth");
const festivalsRoutes = require("./routes/festivals");
const artistsRoutes = require("./routes/artists");
const usersRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");

const morgan = require("morgan");

const app = express();

app.use(
  cors({
    origin: "https://localhost:5000",
  })
)
app.use(express.json());
app.use(morgan("tiny"));
app.use(authenticateJWT);

app.use("/auth", authRoutes);
app.use("/festivals", festivalsRoutes);
app.use("/artists", artistsRoutes);
app.use("/users", usersRoutes);


/** Handle 404 errors -- this matches everything */
app.use(function (req, res, next) {
  throw new NotFoundError();
});

/** Generic error handler; anything unhandled goes here. */
app.use(function (err, req, res, next) {
  if (process.env.NODE_ENV !== "test") console.error(err.stack);
  const status = err.status || 500;
  const message = err.message;

  return res.status(status).json({
    error: { message, status },
  });
});

module.exports = app;
