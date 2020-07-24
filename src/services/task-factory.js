'use strict';

const config = require('../config.json');

/**
 * Task/job factory for devices
 */
class TaskFactory {
    static instance = new TaskFactory(config.instanceName, config.minLevel, config.maxLevel);
    static ivCache = [];
    static pvpCache = [];

    instanceName;
    minLevel;
    maxLevel;

    expireDelay = 15;

    /**
     * Instantiate a new TaskFactory object
     */
    constructor(instanceName, minLevel, maxLevel) {
        this.instanceName = instanceName;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
        this.timer = setInterval(() => this.clearExpired(), this.expireDelay * 1000);
    }

    /**
     * Get the length of the IV cache queue
     */
    length() {
        return TaskFactory.ivCache.length;
    }

    /**
     * Enqueue an element to the end of the queue
     * @param {*} payload 
     */
    enqueue(payload) {
        TaskFactory.ivCache.push(payload.message);
    }

    /**
     * Remove an element from the beginning of the queue
     */
    dequeue() {
        return TaskFactory.ivCache.shift();
    }

    /**
     * Get a list of all available tasks
     */
    getAll() {
        return TaskFactory.ivCache;
    }

    /**
     * Clear expired tasks
     */
    clearExpired() {
        // Loop through all tasks and check if they are expired, if so remove them
        for (let i = 0; i < TaskFactory.ivCache.length; i++) {
            // Get expiration timestamp
            let expires = TaskFactory.ivCache[i].disappear_time;
            // Get now timestamp
            let now = Math.round(new Date().getTime() / 1000);
            // Check if current timestamp is greater than expiration timestamp
            if (now > expires) {
                // Remove item at index of cache
                console.log('[TaskFactory] Removing stale encounter', TaskFactory.ivCache[i].encounter_id, 'from ivCache at index', i + '/' + TaskFactory.ivCache.length, 'expiration time was', new Date(expires * 1000).toLocaleString());
                TaskFactory.ivCache.splice(i, 1);
            }
        }
    }

    /**
     * Get a task for a device
     */
    getTask() {
        console.log('[TaskFactory] Task list:', TaskFactory.ivCache.length);
        // Grab a task from the top of the queue
        let pokemon = this.dequeue();
        if (pokemon === undefined || pokemon === null) {
            return null;
        }
        // Cache the pvp stats to grab later when sending
        TaskFactory.pvpCache.push(pokemon);
        console.log('[TaskFactory] Grabbed task for', pokemon.encounter_id, 'at', pokemon.latitude, pokemon.longitude);
        return {
            'area': this.instanceName,
            'action': 'scan_iv',
            'lat': pokemon.latitude,
            'lon': pokemon.longitude,
            'id': pokemon.encounter_id,
            'is_spawnpoint': pokemon.spawnpoint_id !== undefined && pokemon.spawnpoint_id !== null,
            'min_level': this.minLevel,
            'max_level': this.maxLevel
        };
    }
}

module.exports = TaskFactory;