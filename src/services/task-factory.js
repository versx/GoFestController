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

    /**
     * Instantiate a new TaskFactory object
     */
    constructor(instanceName, minLevel, maxLevel) {
        this.instanceName = instanceName;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
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
     * Get a task for a device
     */
    getTask() {
        console.log('[TaskFactory] Task list:', TaskFactory.ivCache.length);
        let pokemon = this.dequeue();
        if (pokemon === undefined || pokemon === null) {
            return null;
        }
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