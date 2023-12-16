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
  if(spotifyApi.getAccessToken()) {
    const { body } = await spotifyApi.getMe();
    res.render('index.html', { user: body });
  }
  else{
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
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  spotifyApi.resetAccessToken();
  spotifyApi.resetRefreshToken();
  res.redirect('/');
});

app.get('/account', ensureLoggedIn, async (req, res) => {
  const { body } = await spotifyApi.getMe();
  res.render('account.html', { user: body });
});

app.get('/playlists', ensureLoggedIn, async (req, res) => {
  const { body } = await spotifyApi.getUserPlaylists();
  console.log(body);
  res.render('playlists.html', { playlists: body.items });
});

app.get('/submit', ensureLoggedIn, async (req, res) => {
  const { body } = await spotifyApi.getMe();
  res.render('submit.html', { user: body });
});


/** Middleware to use when they must be logged in.
 *
 * If not, raises Unauthorized.
 */

function ensureLoggedIn(req, res, next) {
  if (spotifyApi.getAccessToken()) return next();
  throw new UnauthorizedError();
}


/**
 * Sends request to flask API with image in multipart/form-data
 * Returns response with response.data structure
 * {
 *  boxes: [...,['C','1784','2187','1839','2254'],...]
 *  dim: [int(img_height), int(img_width)]
 *  msg:'success'
 * }
 * @param {file} file image file
*/
async function uploadImage(file) {

  let formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(IMAGE_ENDPOINT, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    }
  });

  return response;
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