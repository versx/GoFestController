'use strict';

const config = require('../config.json');

/**
 * Task/job factory for devices
 */
class TaskFactory {
    static instance = new TaskFactory(config.instanceName, config.minLevel, config.maxLevel);

    instanceName;
    minLevel;
    maxLevel;
    ivCache;

    /**
     * Instantiate a new TaskFactory object
     */
    constructor(instanceName, minLevel, maxLevel) {
        this.instanceName = instanceName;
        this.minLevel = minLevel;
        this.maxLevel = maxLevel;
        if (this.ivCache === undefined || this.ivCache === null) {
            this.ivCache = [];
        }
    }

    /**
     * Get the length of the IV cache queue
     */
    length() {
        return this.ivCache.length;
    }

    /**
     * Enqueue an element to the end of the queue
     * @param {*} payload 
     */
    enqueue(payload) {
        this.ivCache.push(payload.message);
    }

    /**
     * Remove an element from the beginning of the queue
     */
    dequeue() {
        return this.ivCache.shift();
    }

    /**
     * Get a list of all available tasks
     */
    getAll() {
        return this.ivCache;
    }

    /**
     * Get a task for a device
     */
    getTask() {
        console.log('[TaskFactory] Task list:', this.ivCache.length);
        let pokemon = this.dequeue();
        if (pokemon === undefined || pokemon === null) {
            return null;
        }
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