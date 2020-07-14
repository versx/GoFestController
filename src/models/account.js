'use strict';

const query = require('../services/mysql.js');

/**
 * Account model class.
 */
class Account {
    username;
    password;
    firstWarningTimestamp;
    failedTimestamp;
    failed;
    level;
    lastEncounterLat;
    lastEncounterLon;
    lastEncounterTime;
    hasTicket;

    /**
     * Initalize new Account object.
     * @param username 
     * @param password 
     * @param firstWarningTimestamp 
     * @param failedTimestamp 
     * @param failed 
     * @param level 
     * @param lastEncounterLat 
     * @param lastEncounterLon 
     * @param lastEncounterTime 
     * @param hasTicket
     */
    constructor(username, password, firstWarningTimestamp, failedTimestamp, failed,
        level, lastEncounterLat, lastEncounterLon, lastEncounterTime, hasTicket) {
        this.username = username;
        this.password = password;
        if (firstWarningTimestamp > 0) {
            this.firstWarningTimestamp = firstWarningTimestamp;
        }
        if (failedTimestamp > 0) {
            this.failedTimestamp = failedTimestamp;
        }
        this.failed = failed;
        this.level = level;
        this.lastEncounterLat = lastEncounterLat;
        this.lastEncounterLon = lastEncounterLon;
        if (lastEncounterTime > 0) {
            this.lastEncounterTime = lastEncounterTime;
        }
        this.hasTicket = hasTicket;
    }
    
    /**
     * Get all accounts.
     */
    static async getAll() {
        let sql = `
        SELECT username, password, first_warning_timestamp, failed_timestamp, failed, level, last_encounter_lat, last_encounter_lon, last_encounter_time, has_ticket
        FROM account
        `;
        let results = await query(sql)
            .then(x => x)
            .catch(err => {
                console.error('[Account] Error:', err);
                return null;
            });
        let accounts = [];
        if (results && results.length > 0) {
            for (let i = 0; i < results.length; i++) {
                let row = results[i];
                accounts.push(new Account(
                    row.username,
                    row.password,
                    row.first_warning_timestamp,
                    row.failed_timestamp,
                    row.failed,
                    row.level,
                    row.last_encounter_lat,
                    row.last_encounter_lon,
                    row.last_encounter_time,
                    row.has_ticket
                ));
            }
        }
        return accounts;
    }

    /**
     * Get new account between minimum and maximum level.
     * @param minLevel 
     * @param maxLevel 
     */
    static async getNewAccount(minLevel, maxLevel, hasTicket) {
        let sql = `
        SELECT username, password, level, first_warning_timestamp, failed_timestamp, failed, last_encounter_lat, last_encounter_lon, last_encounter_time, has_ticket
        FROM account
        LEFT JOIN device ON username = account_username
        WHERE first_warning_timestamp is NULL AND failed_timestamp is NULL and device.uuid IS NULL AND level >= ? AND level <= ? AND failed IS NULL AND (last_encounter_time IS NULL OR UNIX_TIMESTAMP() - CAST(last_encounter_time AS SIGNED INTEGER) >= 7200 AND spins < 400) AND has_ticket = ?
        ORDER BY level DESC, RAND()
        LIMIT 1
        `;
        let result = await query(sql, [minLevel, maxLevel, hasTicket])
            .then(x => x)
            .catch(err => { 
                console.error('[Account] Failed to get new Account', err);
                return null;
            });
        let account;
        if (result) {
            let keys = Object.values(result);
            keys.forEach(key => {
                account = new Account(
                    key.username,
                    key.password,
                    key.first_warning_timestamp,
                    key.failed_timestamp,
                    key.failed,
                    key.level,
                    key.last_encounter_lat,
                    key.last_encounter_lon,
                    key.last_encounter_time,
                    key.has_ticket
                );
            });
        }
        return account;
    }

    /**
     * Get account with username.
     * @param username 
     */
    static async getWithUsername(username, hasTicket) {
        let sql = `
        SELECT username, password, first_warning_timestamp, failed_timestamp, failed, level, last_encounter_lat, last_encounter_lon, last_encounter_time, hasTicket
        FROM account
        WHERE username = ? AND has_ticket = ?
        LIMIT 1
        `;
        let args = [username, hasTicket];
        let result = await query(sql, args)
            .then(x => x)
            .catch(err => { 
                console.error('[Account] Failed to get Account with username', username, 'Error:', err);
                return null;
            });
        let account;
        let keys = Object.values(result);
        keys.forEach(key => {
            account = new Account(
                key.username,
                key.password,
                key.first_warning_timestamp,
                key.failed_timestamp,
                key.failed,
                key.level,
                key.last_encounter_lat,
                key.last_encounter_lon,
                key.last_encounter_time,
                key.has_ticket
            );
        })
        return account;
    }

    static async getNewAccountNoToken(minLevel, maxLevel) {
        let sql = `
        SELECT username, password, first_warning_timestamp, failed_timestamp, failed, level, last_encounter_lat, last_encounter_lon, last_encounter_time, has_ticket
        FROM account
        LEFT JOIN device ON username = account_username
        WHERE first_warning_timestamp is NULL AND failed_timestamp is NULL and device.uuid IS NULL AND level >= ? AND level <= ? AND failed IS NULL AND (last_encounter_time IS NULL OR UNIX_TIMESTAMP() -  CAST(last_encounter_time AS SIGNED INTEGER) >= 7200 AND spins < 400) AND ptcToken IS NULL
        ORDER BY level DESC, RAND()
        LIMIT 1
        `;
        let args = [minLevel, maxLevel];
        let result = await query(sql, args)
            .then(x => x)
            .catch(err => { 
                console.error('[Account] Failed to get Account between level', minLevel + '-' + maxLevel, 'Error:', err);
                return null;
            });
        let account;
        let keys = Object.values(result);
        keys.forEach(key => {
            account = new Account(
                key.username,
                key.password,
                key.first_warning_timestamp,
                key.failed_timestamp,
                key.failed,
                key.level,
                key.last_encounter_lat,
                key.last_encounter_lon,
                key.last_encounter_time,
                key.has_ticket
            );
        })
        return account;
    }

    /**
     * Add encounter data to specified account.
     * @param username 
     * @param newLat 
     * @param newLon 
     * @param encounterTime 
     */
    static async didEncounter(username, newLat, newLon, encounterTime) {
        let sql = `
        UPDATE account
        SET last_encounter_lat = ?, last_encounter_lon = ?, last_encounter_time = ?
        WHERE username = ?
        `;
        let args = [newLat, newLon, encounterTime, username];
        let result = await query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Account] Failed to set encounter info for account with username', username, 'Error:', err);
                return null;
            });
            console.log('[Account] DidEncounter:', result);
    }

    /**
     * Set account level.
     * @param username 
     * @param level 
     */
    static async setLevel(username, level) {
        let sql = `
        UPDATE account
        SET level = ?
        WHERE username = ?
        `;
        let args = [level, username];
        let result = await query(sql, args)
            .then(x => x)
            .catch(err => { 
                console.error('[Account] Failed to set Account level for username', username, 'Error:', err);
                return null;
            });
        //console.log('[Account] SetLevel:', result);
    }

    static async setInstanceUuid(uuid, area, username) {
        let sql = `
        UPDATE account
        SET last_uuid = ?,
            last_instance = ?
        WHERE username = ?
        `;
        let args = [uuid, area, username];
        let result = await query(sql, args)
            .then(x => x)
            .catch(err => { 
                console.error('[Account] Failed to set Account intance for username', username, 'and device', uuid, 'Error:', err);
                return null;
            });
        console.log('[Account] SetInstanceUuid:', result);
    }
    
    /**
     * Save account.
     * @param update 
     */
    async save(update) {

        let sql = '';
        let args = [];
        if (update) {
            sql = `
            UPDATE account
            SET password = ?, level = ?, first_warning_timestamp = ?, failed_timestamp = ?, failed = ?, last_encounter_lat = ?, last_encounter_lon = ?, last_encounter_time = ?, has_ticket = ?
            WHERE username = ?
            `;
            args = [this.password, this.level, this.firstWarningTimestamp, this.failedTimestamp, this.failed, this.lastEncounterLat, this.lastEncounterLon, this.lastEncounterTime, this.hasTicket, this.username];
        } else {
            sql = `
            INSERT INTO account (username, password, level, first_warning_timestamp, failed_timestamp, failed, last_encounter_lat, last_encounter_lon, last_encounter_time, has_ticket)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            args = [this.username, this.password, this.level, this.firstWarningTimestamp, this.failedTimestamp, this.failed, this.lastEncounterLat, this.lastEncounterLon, this.lastEncounterTime, this.hasTicket];
        }
        let result = await query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Account] Error:', err);
                return null;
            });
        console.log('[Account] Save:', result)
    }
}

// Export the class
module.exports = Account;