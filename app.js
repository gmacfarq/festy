const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const express = require('express');
const consolidate = require('consolidate');
const session = require('express-session');
const { UnauthorizedError, NotFoundError } = require('./expressError');

require('dotenv').config();

const port = process.env.PORT;
const authCallbackPath = '/auth/spotify/callback';

const scopes = [
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-read-private',
  'playlist-modify-private',
  'user-follow-read',
  'user-follow-modify'
],
  showDialog = true,
  responseType = 'token';

const app = express();

app.engine('html', consolidate.nunjucks);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: process.env.SECRET_KEY, resave: false, saveUninitialized: true }));

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: 'http://localhost:' + port + authCallbackPath,
});


app.get('/', async (req, res) => {
  if (spotifyApi.getAccessToken()) {
    currUser = req.session.currUser.body;
    res.render('index.html', { user: currUser });
  }
  else {
    res.render('index.html');
  }
});

app.get('/login', (req, res) => {
  res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get(authCallbackPath, async (req, res) => {
  const { body } = await spotifyApi.authorizationCodeGrant(req.query.code);
  spotifyApi.setAccessToken(body['access_token']);
  spotifyApi.setRefreshToken(body['refresh_token']);
  console.log(body);

  req.session.currUser = await spotifyApi.getMe();

  res.redirect('/');
});

app.get('/logout', (req, res) => {

  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    spotifyApi.resetAccessToken();
    spotifyApi.resetRefreshToken();
    res.redirect('/');
  });
});

app.get('/profile', ensureLoggedIn, async (req, res) => {
  currUser = req.session.currUser.body;
  console.log(currUser);

  res.render('profile.html', { user: currUser });
});

app.get('/playlists', ensureLoggedIn, async (req, res) => {
  const { body } = await spotifyApi.getUserPlaylists();
  currUser = req.session.currUser.body;
  res.render('playlists.html', { playlists: body.items, user: currUser });
});


app.get('/festivals', async (req, res) => {
  currUser = req.session.currUser?.body;
  res.render('festivals.html', { user: currUser });
});

app.get('/feed', async (req, res) => {
  currUser = req.session.currUser?.body;
  res.render('feed.html', { user: currUser });
});


/** Middleware to use when they must be logged in.
 *
 * If not, raises Unauthorized.
 */

function ensureLoggedIn(req, res, next) {
  if (req.session.currUser) return next();
  throw new UnauthorizedError();
}

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