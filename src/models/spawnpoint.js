'use strict';

const config = require('../config.json');
const MySQLConnector = require('../services/mysql.js');
const db = new MySQLConnector(config.db.rdm);
const { getCurrentTimestamp } = require('../utilities/utils.js');

/**
 * Spawnpoint model class.
 */
class Spawnpoint {
    id;
    lat;
    lon;
    despawnSecond;
    updated;

    /**
     * Initialize new Spawnpoint object.
     * @param data 
     */
    constructor(id, lat, lon, despawnSecond, updated) {
        this.id = BigInt(id).toString();
        this.lat = lat;
        this.lon = lon;
        this.despawnSecond = despawnSecond;
        this.updated = updated;
    }

    /**
     * Get Spawnpoint by spawnpoint id.
     * @param spawnpointId 
     */
    static async getById(spawnpointId) {
        let sql = `
            SELECT id, lat, lon, updated, despawn_sec
            FROM spawnpoint
            WHERE id = ?
        `;
        let args = [spawnpointId];
        let result = await db.query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Spawnpoint] Error:', err);
            });
        let spawnpoint;
        if (result) {
            let keys = Object.values(result);
            if (keys.length === 0) {
                return null;
            }
            keys.forEach(key => {
                spawnpoint = new Spawnpoint(
                    BigInt(key.id).toString(),
                    key.lat,
                    key.lon,
                    key.despawn_sec,
                    key.updated
                );
            });
        }
        return spawnpoint;
    }

    /**
     * Save Spawnpoint model data.
     */
    async save(update = false) {
        let oldSpawnpoint;
        try {
            oldSpawnpoint = await Spawnpoint.getById(this.id);
        } catch (err) {
            oldSpawnpoint = null;
        }
        this.updated = getCurrentTimestamp();
        
        if (!update && oldSpawnpoint) {
            return;
        }
        
        if (oldSpawnpoint) {
            if ((this.despawnSecond === undefined || this.despawnSecond === null) && oldSpawnpoint.despawnSecond) {
                this.despawnSecond = oldSpawnpoint.despawnSecond;
            }            
            if (this.lat === oldSpawnpoint.lat &&
                this.lon === oldSpawnpoint.lon &&
                this.despawnSecond === oldSpawnpoint.despawnSecond) {
                return;
            }
        }

        let sql = `
            INSERT INTO spawnpoint (id, lat, lon, updated, despawn_sec)
            VALUES (?, ?, ?, UNIX_TIMESTAMP(), ?)
        `;
        if (update) {
            sql += `
            ON DUPLICATE KEY UPDATE
            lat=VALUES(lat),
            lon=VALUES(lon),
            updated=VALUES(updated),
            despawn_sec=VALUES(despawn_sec)
            `;
        }
        let args = [this.id, this.lat, this.lon, this.despawnSecond || null];
        await db.query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Spawnpoint] Error:', err);
        });     
    }

    /**
     * Get Spawnpoint as JSON message for webhook payload
     */
    toJson() {
        return {
            type: 'spawnpoint',
            message: {
                id: parseInt(this.id, 16),
                lat: this.lat,
                lon: this.lon,
                updated: this.updated || 1,
                despawn_second: this.despawnSecond
            }
        };
    }
}

module.exports = Spawnpoint;