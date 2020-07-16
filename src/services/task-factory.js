'use strict';

// TODO Make configurable
const MIN_LEVEL = 30;
const MAX_LEVEL = 35;

/**
 * 
 */
class TaskFactory {
    ivCache;

    /**
     * Instantiate a new TaskFactory object
     */
    constructor() {
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

    getAll() {
        return this.ivCache;
    }

    getTask() {
        console.log('[TaskFactory] Task list:', this.ivCache.length);
        let pokemon = this.dequeue();
        if (pokemon === undefined || pokemon === null) {
            return null;
        }
        console.log('[TaskFactory] Grabbed task for', pokemon.encounter_id, 'at', pokemon.latitude, pokemon.longitude);
        return {
            'area': 'GoFest-Test', // TODO: Instance name
            'action': 'scan_iv',
            'lat': pokemon.latitude,
            'lon': pokemon.longitude,
            'id': pokemon.encounter_id,
            'is_spawnpoint': pokemon.spawnpoint_id !== undefined && pokemon.spawnpoint_id !== null,
            'min_level': MIN_LEVEL,
            'max_level': MAX_LEVEL
        };
    }
}

module.exports = TaskFactory;