const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');

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

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: 'http://localhost:' + port + authCallbackPath,
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


module.exports = app;