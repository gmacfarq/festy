const db = require('../db');
const { NotFoundError } = require('../expressError');

class Festival {
  /**
   * Fetch the 6 festivals that are happening soonest.
   * @returns {Promise<Array>} An array of 9 festivals happening soonest.
  */
  static async getByDate() {
    const query = `
    SELECT id, name, date, location
    FROM festivals
    ORDER BY date
    LIMIT 6`;

    const result = await db.query(query);

    return result.rows;
  }

  /**
   * Search for festivals by name and return up to 6 results.
   * @param {string} searchTerm - The search term for festival names.
   * @returns {Promise<Array>} An array of up to 6 festivals matching the search term.
   */
  static async searchByName(searchTerm) {
    const query = `
      SELECT id, name, date, location
      FROM festivals
      WHERE name ILIKE $1
      LIMIT 6`;

    const result = await db.query(query, [`%${searchTerm}%`]);

    return result.rows;
  }

  /**
   * Search for festivals by artist and return up to 6 results.
   * @param {string} artistName - The name of the artist to search for.
   * @returns {Promise<Array>} An array of up to 6 festivals featuring the specified artist.
   */
  static async searchByArtist(artistName) {
    const query = `
      SELECT f.id, f.name, f.date, f.location
      FROM festivals f
      JOIN acts a ON f.id = a.event_id
      JOIN artists ar ON a.artist_id = ar.id
      WHERE ar.name ILIKE $1
      LIMIT 6`;

    const result = await db.query(query, [`%${artistName}%`]);

    return result.rows;
  }

  /**
   * Fetch a single festival with its associated "Acts."
   * @param {number} festivalId - The ID of the festival to fetch.
   * @returns {Promise<Object|null>} The festival object with associated acts, or null if not found.
   */
  static async getFestivalWithActs(festivalId) {
    const festivalQuery = `
      SELECT id, name, date, location
      FROM festivals
      WHERE id = $1`;

    const actsQuery = `
      SELECT ar.id AS artist_id, ar.name AS artist_name, ar.popularity
      FROM acts a
      JOIN artists ar ON a.artist_id = ar.id
      WHERE a.event_id = $1
      ORDER BY ar.popularity DESC`;

    const festivalResult = await db.query(festivalQuery, [festivalId]);

    if (festivalResult.rows.length === 0) {
      throw new NotFoundError('Festival not found');
    }

    const actsResult = await db.query(actsQuery, [festivalId]);
    const festival = festivalResult.rows[0];
    festival.acts = actsResult.rows;

    return festival;
  }
}

module.exports = Festival;