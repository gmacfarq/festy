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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SECRET_KEY, resave: false, saveUninitialized: true }));

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: 'http://localhost:' + port + authCallbackPath,
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

    // Render the 'festivals.html' template with the retrieved festival data and user data
    res.render('festivals.html', { festivals, user: currUser });
  } catch (err) {
    // Handle any errors here, such as database query errors
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.route('/festivals/:id')
  .get(async (req, res) => {
    try {
      // Retrieve the festival ID from the request parameters
      const festivalId = req.params.id;

      // Call the getFestivalWithActs function to retrieve the festival data
      const festival = await Festival.getFestivalWithActs(festivalId);

      // Retrieve the current user from the session if needed
      const currUser = req.session.currUser;

      // Render the 'festival.html' template with the retrieved festival data and user data
      res.render('festival.html', { festival, user: currUser });
    } catch (err) {
      // Handle any errors here, such as database query errors
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  })
  .post(async (req, res) => {
    try {
      console.log(req.body);
      const artistIds = req.body.artistIds;
      const trackCounts = req.body.trackCounts;

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
      const playlistResponse = await spotifyApi.createPlaylist('FESTY OSL 2023 test 100+ playlist', { 'description': 'My description', 'public': true });
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
  });
//     let trackIds = {}; // Initialize trackIds object

//     // Iterate through the artist IDs and counts in the array
//     for (let i = 0; i < artistTrackData.length; i++) {
//       const artistId = artistTrackData[i].id;
//       const trackCount = artistTrackData[i].count;
//       const topTrackIds = await fetchTopTracks(artistId, trackCount);
//       trackIds[artistId] = topTrackIds;
//     }

//     // You now have track IDs stored in the 'trackIds' object
//     console.log(trackIds);

//     // Respond with the track IDs or perform any other desired actions
//     res.json({ trackIds });

//     const playlistName = 'My Festival Playlist';
//     const playlistDescription = 'Playlist created for the festival';
//     const createPlaylistResponse = await spotifyApi.createPlaylist(playlistName, {
//       description: playlistDescription,
//       public: false, // You can set this to true for a public playlist
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).send('Internal Server Error');
//   }
// });


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