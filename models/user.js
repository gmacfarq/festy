"use strict";

const db = require("../db");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

class User {
  static async checkUserExists(spotifyUserId) {
    // Check if the user exists in the database
    const result = await db.query(
      `SELECT spotify_user_id
      FROM users
      WHERE spotify_user_id = $1`,
      [spotifyUserId]
    );
    return result.rows.length > 0;
  }

  static async createUser(spotifyUserId, displayName) {
    // Create a new user record in the database
    const result = await db.query(
      `INSERT INTO users (spotify_user_id, username)
      VALUES ($1, $2)
      RETURNING spotify_user_id, username`,
      [spotifyUserId, displayName]
    );
  }
  static async getUserId(spotifyUserId) {
    // Get a user from the database
    const result = await db.query(
      `SELECT id
      FROM users
      WHERE spotify_user_id = $1`,
      [spotifyUserId]
    );
    return result.rows[0];
  }

  static async getPlaylists(userId) {
    // Get all playlists for a user
    const result = await db.query(
      `SELECT id, playlist_spotify_id, name
      FROM playlists
      WHERE user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  static async addPlaylist(userId, playlistSpotifyId, name) {
    // Add a playlist to the database
    const result = await db.query(
      `INSERT INTO playlists (user_id, playlist_spotify_id, name)
      VALUES ($1, $2, $3)
      RETURNING id, playlist_spotify_id, name`,
      [userId, playlistSpotifyId, name]
    );
    return result.rows[0];
  }

  static async deletePlaylist(playlistId, userId) {
    // Delete a playlist from the database
    const result = await db.query(
      `DELETE FROM playlists
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
      [playlistId, userId]
    );
    return result.rows[0];
  }

  static async updatePlaylistCreatedAt(playlistId, createdAt) {
    // Update the created_at field for a playlist
    const result = await db.query(
      `UPDATE playlists
      SET created_at = $2
      WHERE id = $1
      RETURNING id`,
      [playlistId, createdAt]
    );
    return result.rows[0];
  }
}

module.exports = User;