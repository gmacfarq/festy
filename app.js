const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const express = require('express');
const consolidate = require('consolidate');
const session = require('express-session');
const { UnauthorizedError, NotFoundError } = require('./expressError');
const User = require('./models/user');
const Festival = require('./models/festival');
const { default: axios } = require('axios');
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SECRET_KEY, resave: false, saveUninitialized: true, cookie: { secure: false } }));

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: 'http://localhost:' + port + authCallbackPath,
});

app.use((req, res, next) => {
  // Exclude auth routes from redirect capture
  if (!req.path.startsWith('/auth')) {
    // Attempt to capture the redirect URL
    const redirectTo = req.query.redirectTo || req.get('Referer') || '/';
    req.session.redirectTo = redirectTo;
  }
  next();
});

app.use((req, res, next) => {
  if (req.session.flashMessage) {
    res.locals.flashMessage = req.session.flashMessage;
    delete req.session.flashMessage;
  }
  next();
});

app.get('/', async (req, res) => {
  if (spotifyApi.getAccessToken()) {
    const currUser = req.session.currUser;
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
  try{

    const { body } = await spotifyApi.authorizationCodeGrant(req.query.code);
    spotifyApi.setAccessToken(body['access_token']);
    spotifyApi.setRefreshToken(body['refresh_token']);
    const expires_in = body['expires_in'];

    console.log(
      `Sucessfully retreived access token. Expires in ${expires_in} s.`
    );

    setInterval(async () => {
      const data = await spotifyApi.refreshAccessToken();
      const access_token = data.body['access_token'];

      console.log('The access token has been refreshed!');
      console.log('access_token:', access_token);
      spotifyApi.setAccessToken(access_token);
    }, expires_in / 2 * 1000);
  }
  catch{
    console.log('Error getting access token:', err);
  }

  user = await spotifyApi.getMe();
  req.session.currUser = user.body;

  const spotifyUserId = user.body.id;
  const userExists = await User.checkUserExists(spotifyUserId);

  if (!userExists) {
    const displayName = user.body.display_name;
    await User.createUser(spotifyUserId, displayName);
  }

  const redirectUrl = req.session.redirectTo || '/';
  res.redirect(redirectUrl);

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

  res.render('profile.html', { user: currUser });
});

app.get('/playlists', ensureLoggedIn, async (req, res) => {
  const { body } = await spotifyApi.getUserPlaylists();
  const currUser = req.session.currUser;
  res.render('playlists.html', { playlists: body.items, user: currUser });
});


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
app.post('/festivals/:id', async (req, res) => {

  try {
    console.log(req.body);
    const artistIds = req.body.artistIds;
    const trackCounts = req.body.trackCounts;
    const festivalName = req.body.festivalName;

    // Combine artist IDs and track counts into an array of objects
    const artistTrackData = artistIds.map((id, index) => {
      return { id: id, count: parseInt(trackCounts[index], 10) };
    });

    // Define a function to fetch top tracks for an artist
    const fetchTopTracks = async (artistId, count) => {
      const topTracksResponse = await spotifyApi.getArtistTopTracks(artistId, 'US');
      const topTracks = topTracksResponse.body.tracks.slice(0, count); // Get the first 'count' tracks
      return topTracks.map(track => `spotify:track:${track.id}`); // Extract track IDs
    };

    let allTrackUris = [];

    // Fetch tracks for each artist and accumulate their URIs
    for (let i = 0; i < artistTrackData.length; i++) {
      const artistId = artistTrackData[i].id;
      const trackCount = artistTrackData[i].count;

      const topTrackUris = await fetchTopTracks(artistId, trackCount);
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