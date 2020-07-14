'use strict';

// TODO Make configurable
const MIN_LEVEL = 30;
const MAX_LEVEL = 35;

/**
 * 
 */
class TaskFactory {
    static hundredIVCache;

    /**
     * Instantiate a new TaskFactory object
     */
    constructor() {
        if (TaskFactory.hundredIVCache === undefined || TaskFactory.hundredIVCache === null) {
            TaskFactory.hundredIVCache = [];
        }
    }

    /**
     * Enqueue an element to the end of the queue
     * @param {*} payload 
     */
    enqueue(payload) {
        TaskFactory.hundredIVCache.push(payload.message);
    }

    /**
     * Remove an element from the beginning of the queue
     */
    dequeue() {
        return TaskFactory.hundredIVCache.shift();
    }

    getTask() {
        console.log("[TaskFactory] Task list:", TaskFactory.hundredIVCache.length);
        let pokemon = this.dequeue();
        if (pokemon === undefined || pokemon === null) {
            //return null;
            return {
                "area": "GoFest-Test",
                "action": "scan_iv",
                "lat": 0,
                "lon": 0,
                "id": 0,
                "is_spawnpoint": false,
                "min_level": MIN_LEVEL,
                "max_level": MAX_LEVEL
            };
        }
        console.log("[TaskFactory] Grabbed task for", pokemon.encounter_id, "at", pokemon.latitude, pokemon.longitude);
        return {
            "area": "GoFest-Test", // TODO: Instance name
            "action": "scan_iv",
            "lat": pokemon.latitude,
            "lon": pokemon.longitude,
            "id": pokemon.encounter_id,
            "is_spawnpoint": pokemon.spawnpoint_id !== undefined && pokemon.spawnpoint_id !== null,
            "min_level": MIN_LEVEL,
            "max_level": MAX_LEVEL
        };
    }
}

module.exports = TaskFactory;