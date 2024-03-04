const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const express = require('express');
const consolidate = require('consolidate');
const session = require('express-session');
const { UnauthorizedError, NotFoundError } = require('./expressError');
const User = require('./models/user');
const Festival = require('./models/festival');
const Artist = require('./models/artist');
const { shuffleArray } = require('./helpers/playlist');
// const { default: axios } = require('axios');
require('dotenv').config();

const port = process.env.PORT;
const ec2Url = 'http://ec2-54-183-183-107.us-west-1.compute.amazonaws.com';
const authCallbackPath = '/auth/spotify/callback';

const scopes = [
  'playlist-modify-public',
],
  showDialog = true,
  responseType = 'token';

const app = express();

app.engine('html', consolidate.nunjucks);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SECRET_KEY, resave: false, saveUninitialized: true, cookie: { secure: false } }));

var masterSpotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: ec2Url + ':' + port + authCallbackPath,
});

/**
 *  Middleware to capture the redirect URL.
 */
app.use((req, res, next) => {
  // Exclude auth routes from redirect capture
  if (!req.path.startsWith('/auth')) {
    // Attempt to capture the redirect URL
    const redirectTo = req.query.redirectTo || req.get('Referer') || '/';
    req.session.redirectTo = redirectTo;
  }
  next();
});

/**
 * Middleware to add flash messages to the response locals.
 */
app.use((req, res, next) => {
  if (req.session.flashMessage) {
    res.locals.flashMessage = req.session.flashMessage;
    delete req.session.flashMessage;
  }
  next();
});

/** GET /
 * Render the home page.
 */
app.get('/', async (req, res) => {
  const currUser = req.session.currUser;
  if (currUser) {
    res.render('index.html', { user: currUser });
  }
  else {
    res.render('index.html');
  }
});

/** GET /login
 * Redirect to the Spotify login page.
 */
app.get('/login', (req, res) => {
  res.redirect(masterSpotifyApi.createAuthorizeURL(scopes));
});

/** GET /auth/spotify/callback
 * Exchange the code for an access token and redirect to the redirectURL.
 * If an error occurs, the response should have a 500 status code and an error message.
 */
app.get(authCallbackPath, async (req, res) => {
  try {

    const { body } = await masterSpotifyApi.authorizationCodeGrant(req.query.code);
    req.session.spotifyTokens = {
      accessToken: body['access_token'],
      refreshToken: body['refresh_token'],
      expiresIn: body['expires_in']
    };

    const expires_in = body['expires_in'];

    const spotifyApi = initializeSpotifyApi(req.session);

    setInterval(async () => {
      const data = await spotifyApi.refreshAccessToken();
      const access_token = data.body['access_token'];

      console.log('The access token has been refreshed!');
      spotifyApi.setAccessToken(access_token);
    }, expires_in / 2 * 1000);


    const user = await spotifyApi.getMe();
    req.session.currUser = user.body;

    const spotifyUserId = user.body.id;
    const userExists = await User.checkUserExists(spotifyUserId);

    if (!userExists) {
      const displayName = user.body.display_name;
      await User.createUser(spotifyUserId, displayName);
    }
    userDBId = await User.getUserId(spotifyUserId);
    req.session.currUser.dbid = userDBId.id;
    const redirectUrl = req.session.redirectTo || '/';
    res.redirect(redirectUrl);
  }
  catch (err) {
    console.log('Error logging in:', err);
    res.status(500).send('Internal Server Error');
  }

});

/** GET /logout
 * Log out the current user.
 * The response should redirect to the home page.
 */
app.get('/logout', (req, res) => {

  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

/** GET /profile
 * Retrieve the current user's profile.
 * The response should be a JSON object with the user data.
 */
app.get('/profile', ensureLoggedIn, async (req, res) => {
  const currUser = req.session.currUser;


  res.render('profile.html', { user: currUser });
});

app.get('/playlists', ensureLoggedIn, async (req, res) => {
  const currUser = req.session.currUser;

  const spotifyApi = initializeSpotifyApi(req.session);
  const playlists = await User.getPlaylists(currUser.dbid);
  for (playlist of playlists) {
    playlist.url = `https://open.spotify.com/playlist/${playlist.playlist_spotify_id}`;
  }

  res.render('playlists.html', { playlists: playlists, user: currUser });
});

/** GET /festivals
 * Retrieve all festivals.
 * The response should be a JSON object with the festival data.
 * If an error occurs, the response should have a 500 status code and an error message.
 */
app.get('/festivals', async (req, res) => {
  try {

    const festivals = await Festival.getByDate();

    const currUser = req.session.currUser;

    for (festival of festivals) {
      festival.date = festival.date.toISOString().split('T')[0];
    }


    // Render the 'festivals.html' template with the retrieved festival data and user data
    res.render('festivals.html', { festivals, user: currUser });
  } catch (err) {
    // Handle any errors here, such as database query errors
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

/** GET /festivals/:id
 * Retrieve the festival with the given ID.
 * The response should be a JSON object with the festival data.
 * If an error occurs, the response should have a 500 status code and an error message.
 */

app.get('/festivals/:id', async (req, res) => {
  try {
    // Retrieve the festival ID from the request parameters
    const festivalId = req.params.id;

    // Call the getFestivalWithActs function to retrieve the festival data
    const festival = await Festival.getFestivalWithActs(festivalId);

    //format date
    festival.date = festival.date.toISOString().split('T')[0];

    // Retrieve the current user from the session if needed
    const currUser = req.session.currUser;

    // Render the 'festival.html' template with the retrieved festival data and user data
    res.render('festival.html', { festival, user: currUser });
  } catch (err) {
    // Handle any errors here, such as database query errors
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

/**  POST /festivals/:id
* Create a new playlist for the festival with the given ID.
* The request body should contain a festivla name, an array of artist IDs and an array of track counts.
*
* The playlist should be created and the tracks added to it.
* The response should be a JSON object with a message and the playlist ID.
* If an error occurs, the response should have a 500 status code and an error message.
*/

app.post('/festivals/:user', async (req, res) => {

  try {
    const spotifyApi = initializeSpotifyApi(req.session);
    const currUser = req.session.currUser;

    const artistIds = req.body.artistIds;
    const trackCounts = req.body.trackCounts;
    const festivalName = req.body.festivalName;

    // Combine artist IDs and track counts into an array of objects
    const artistTrackData = artistIds.map((id, index) => {
      return { id: id, count: parseInt(trackCounts[index], 10) };
    });

    // Define a function to fetch top tracks for an artist
    const fetchTopTracks = async (artistSpotifyId, count) => {
      //TODO: chack if tracks need to be updated
      //If need to be updated then update with API call
      //otherwise get from database
      const topTracks = await Artist.getTracks(artistSpotifyId);
      if (topTracks.length === 0) {
        const topTracksResponse = await spotifyApi.getArtistTopTracks(artistSpotifyId, 'US');
        for (let track of topTracksResponse.body.tracks) {
          await Artist.addTrack(artistSpotifyId, track.id);
        }
        let topTracks = shuffleArray(topTracksResponse.body.tracks);
        topTracks = topTracks.slice(0, count);
        return topTracks.map(track => `spotify:track:${track.id}`);
      }
      for (let track of topTracks) {
        if (Date.now() - track.date_added > 604800000) { //check if track is older than 7 days
          await Artist.deleteTracks(artistSpotifyId);
          const topTracksResponse = await spotifyApi.getArtistTopTracks(artistSpotifyId, 'US');
          for (let track of topTracksResponse.body.tracks) {
            await Artist.addTrack(artistSpotifyId, track.id);
          }
          let topTracks = shuffleArray(topTracksResponse.body.tracks);
          topTracks = topTracks.slice(0, count);
          return topTracks.map(track => `spotify:track:${track.id}`);
        }
      }
      let requestedTracks = shuffleArray(topTracks);
      requestedTracks = requestedTracks.slice(0, count); // Get the first 'count' tracks
      return requestedTracks.map(track => `spotify:track:${track.track_spotify_id}`); // Extract track IDs
    };

    let allTrackUris = [];

    // Fetch tracks for each artist and accumulate their URIs
    for (let i = 0; i < artistTrackData.length; i++) {
      const artistSpotifyId = artistTrackData[i].id;
      const trackCount = artistTrackData[i].count;

      const topTrackUris = await fetchTopTracks(artistSpotifyId, trackCount);
      allTrackUris = allTrackUris.concat(topTrackUris);
    }

    // Create a new playlist
    const playlistResponse = await spotifyApi.createPlaylist(`${festivalName} Playlist`, { 'description': 'Made with Festy', 'public': true });
    const playlistId = playlistResponse.body.id;

    // Function to add tracks to playlist in batches of 100
    const addTracksInBatches = async (trackUris, playlistId) => {
      for (let i = 0; i < trackUris.length; i += 100) {
        const batch = trackUris.slice(i, i + 100);
        await spotifyApi.addTracksToPlaylist(playlistId, batch);
      }
    };

    // Add tracks to the playlist in batches
    await addTracksInBatches(allTrackUris, playlistId);
    await User.addPlaylist(currUser.dbid, playlistId, `${festivalName} Playlist`);
    res.json({ message: 'Playlist created and tracks added!', playlistId: playlistId });

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
}
);


app.get('/feed', async (req, res) => {
  const currUser = req.session.currUser;
  res.render('feed.html', { user: currUser });
});


/** Middleware to use when they must be logged in.
 *
 * If not, raises Unauthorized.
 */

function ensureLoggedIn(req, res, next) {
  if (!req.session.currUser) {
    req.session.flashMessage = {
      message: 'You must be logged in.',
      color: 'red'
    };

    return res.redirect('/');
  }
  next();
}

/**
 * Initializes a SpotifyWebApi instance with credentials and tokens from the session.
 * @param {Object} session - The HTTP session object.
 * @returns {SpotifyWebApi} An instance of SpotifyWebApi or null if tokens are not available.
 */
function initializeSpotifyApi(session) {
  // Check if the session has stored Spotify tokens
  if (session && session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      redirectUri: process.env.REDIRECT_URI
    });

    // Set the access and refresh tokens for the Spotify API instance
    spotifyApi.setAccessToken(session.spotifyTokens.accessToken);
    spotifyApi.setRefreshToken(session.spotifyTokens.refreshToken);

    return spotifyApi;
  } else {
    console.log("Spotify tokens are not available in the session.");
    return null;
  }
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