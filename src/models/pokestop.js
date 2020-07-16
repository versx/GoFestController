'use strict';

const query = require('../services/mysql.js');

/**
 * Pokestop model class.
 */
class Pokestop {
    static LureTime = 1800;

    id;
    lat;
    lon;
    name;
    url;
    enabled;
    cellId;

    /**
     * Initialize new Pokestop object.
     * @param data 
     */
    constructor(id, lat, lon, name, url, enabled, cellId) {
        this.id = String(id);
        this.lat = lat;
        this.lon = lon;
        this.name = name;
        this.url = url;
        this.enabled = enabled;
        this.cellId = String(cellId);
    }

    /**
     * Get pokestop by pokestop id.
     * @param pokestopId 
     * @param withDeleted 
     */
    static async getById(pokestopId, withDeleted = false) {
        let withDeletedSQL = withDeleted ? '' : 'AND deleted = false';
        let sql = `
        SELECT id, lat, lon, name, url, enabled, cell_id
        FROM pokestop
        WHERE id = ? ${withDeletedSQL}
        LIMIT 1
        `;
        let args = [pokestopId];
        let results = await query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Pokestop] Error:', err);
                return null;
            });
        let keys = Object.values(results);
        if (keys.length === 0) {
            return null;
        }
        let pokestop;
        keys.forEach(key => {
            pokestop = new Pokestop(
                key.id,
                key.lat,
                key.lon,
                key.name,
                key.url,
                key.enabled,
                key.cell_id
            );
        })
        return pokestop;
    }
}

// Export the class
module.exports = Pokestop;