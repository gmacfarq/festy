const db = require('../db');
const { NotFoundError } = require('../expressError');

class Artist {
  /**
   * fetch all artists
   */
  static async getAll() {
    const query = `
      SELECT id, name, popularity
      FROM artists
      ORDER BY popularity DESC`;
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * fetch an artists tracks
   */
  static async getTracks(artistSpotifyId) {
    const query = `
      SELECT id, track_spotify_id, artist_id, date_added
      FROM tracks
      WHERE artist_id = $1
      ORDER BY date_added ASC
      LIMIT 10`;
    const result = await db.query(query, [artistSpotifyId]);
    return result.rows;
  }

  /**
   * delete all tracks for an artist
   */
  static async deleteTracks(artistId) {
    const query = `
      DELETE FROM tracks
      WHERE artist_id = $1`;
    const result = await db.query(query, [artistId]);
    return result.rows;
  }

  /**
   * add a track for an artist
   */
  static async addTrack(artistSpotifyId, trackSpotifyId) {
    const query = `
      INSERT INTO tracks (artist_id, track_spotify_id)
      VALUES ($1, $2)
      RETURNING id, artist_id, track_spotify_id, date_added`;
    const result = await db.query(query, [artistSpotifyId, trackSpotifyId]);
    return result.rows[0];
  }

}
module.exports = Artist;