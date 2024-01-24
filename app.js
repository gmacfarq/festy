const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const express = require('express');
const consolidate = require('consolidate');
const session = require('express-session');
const { UnauthorizedError, NotFoundError } = require('./expressError');
const User = require('./models/user');
const Festival = require('./models/festival');
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
    const currUser = req.session.currUser
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

  user = await spotifyApi.getMe();
  req.session.currUser = user.body;

  const spotifyUserId = user.body.id;
  const userExists = await User.checkUserExists(spotifyUserId);

  if (!userExists) {
    const displayName = user.body.display_name;
    await User.createUser(spotifyUserId, displayName);
  }

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
  const currUser = req.session.currUser;
  console.log(currUser);

  res.render('profile.html', { user: currUser });
});

app.get('/playlists', ensureLoggedIn, async (req, res) => {
  const { body } = await spotifyApi.getUserPlaylists();
  const currUser = req.session.currUser;
  res.render('playlists.html', { playlists: body.items, user: currUser });
});


app.get('/festivals', async (req, res) => {
  try {
    // Call the getByDate function to retrieve the 9 festivals happening soonest
    const festivals = await Festival.getByDate();

    // Retrieve the current user from the session if needed
    const currUser = req.session.currUser;
    console.log(festivals);

    // Render the 'festivals.html' template with the retrieved festival data and user data
    res.render('festivals.html', { festivals, user: currUser });
  } catch (err) {
    // Handle any errors here, such as database query errors
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/festivals/:id', async (req, res) => {
  try {
    // Retrieve the festival ID from the request parameters
    const festivalId = req.params.id;

    // Call the getFestivalWithActs function to retrieve the festival data
    const festival = await Festival.getFestivalWithActs(festivalId);

    // Retrieve the current user from the session if needed
    const currUser = req.session.currUser;
    console.log(festival)

    // Render the 'festival.html' template with the retrieved festival data and user data
    res.render('festival.html', { festival, user: currUser });
  } catch (err) {
    // Handle any errors here, such as database query errors
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/feed', async (req, res) => {
  const currUser = req.session.currUser;
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