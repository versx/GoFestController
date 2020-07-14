'use strict';

const query = require('../services/mysql.js');
const { getCurrentTimestamp } = require('../utilities/utils.js');

class Pokemon {
    static DittoPokemonId = 132;
    static WeatherBoostMinLevel = 6;
    static WeatherBoostMinIvStat = 4;
    static PokemonTimeUnseen = 1200;
    static PokemonTimeReseen = 600;

    id;
    lat;
    lon;
    pokemonId;
    form = 0;
    gender;
    costume;
    shiny;
    weather;
    level;
    cp;
    move1;
    move2;
    size;
    weight;
    spawnId;
    expireTimestamp;
    expireTimestampVerified = false;
    firstSeenTimestamp;
    pokestopId = null;
    atkIv;
    defIv;
    staIv;
    username;
    updated;
    changed;
    cellId;
    displayPokemonId;
    isDitto = false;

    /**
     * Initialize new Pokemon object.
     * @param data 
     */
    constructor(data) {
        if (data.wild) {
            this.initWild(data);
        } else if (data.nearby) {
            this.initNearby(data);
        } else {
            this.id = String(data.id);
            this.lat = data.lat;
            this.lon = data.lon;
            this.pokemonId = data.pokemon_id;
            this.form = data.form;
            this.level = data.level;
            this.costume = data.costume;
            this.weather = data.weather;
            this.gender = data.gender;
            this.spawnId = data.spawn_id;
            this.cellId = String(data.cell_id);
            this.firstSeenTimestamp = data.first_seen_timestamp;
            this.expireTimestamp = data.expire_timestamp;
            this.expireTimestampVerified = data.expire_timestamp_verified;
            this.cp = data.cp;
            this.move1 = data.move_1;
            this.move2 = data.move_2;
            this.size = data.size; // REVIEW: height
            this.weight = data.weight;
            this.atkIv = data.atk_iv;
            this.defIv = data.def_iv;
            this.staIv = data.sta_iv;
            this.username = data.username;
            this.shiny = data.shiny;
            this.updated = data.updated;
            this.changed = data.changed;
            this.pokestopId = data.pokestop_id;
            this.displayPokemonId = data.display_pokemon_id;
        }
    }

    async initWild(data) {
        this.id = data.wild.data.encounter_id.toString();
        //console.log("Wild Pokemon Data:", data.wild.data.pokemon_data);
        this.pokemonId = data.wild.data.pokemon_data.pokemon_id;
        if (data.wild.data.latitude === undefined || data.wild.data.latitude === null) {
            console.debug("[Pokemon] Wild Pokemon null lat/lon!");
        }
        this.lat = data.wild.data.latitude;
        this.lon = data.wild.data.longitude;
        let spawnId = parseInt(data.wild.data.spawn_point_id, 16).toString();
        this.gender = data.wild.data.pokemon_data.pokemon_display.gender;
        this.form = data.wild.data.pokemon_data.pokemon_display.form;
        if (data.wild.data.pokemon_data.pokemon_display) {
            this.costume = data.wild.data.pokemon_data.pokemon_display.costume;
            this.weather = data.wild.data.pokemon_data.pokemon_display.weather_boosted_condition;
        }
        this.username = data.wild.username;
        if (data.wild.data.time_till_hidden_ms > 0 && data.wild.data.time_till_hidden_ms <= 90000) {
            this.expireTimestamp = Math.round(data.wild.timestampMs / 1000 + data.wild.data.time_till_hidden_ms);
            this.expireTimestampVerified = true;
        } else {
            this.expireTimestampVerified = false;
        }
        if (!this.expireTimestampVerified && spawnId) {
            // Spawnpoint not verified, check if we have the tth.
            let spawnpoint = {};
            // TODO: Spawnpoints
            /*
            try {
                spawnpoint = await Spawnpoint.getById(spawnId);
            } catch (err) {
                spawnpoint = null;
            }
            */
            if (spawnpoint instanceof Spawnpoint) {
                let expireTimestamp = this.getDespawnTimer(spawnpoint, data.timestampMs);
                if (expireTimestamp > 0) {
                    this.expireTimestamp = expireTimestamp;
                    this.expireTimestampVerified = true;
                }
            }
        }
        this.spawnId = spawnId;
        this.cellId = String(data.cell);
    }

    async initNearby(data) {
        this.id = String(data.nearby.data.encounter_id);
        this.pokemonId = data.nearby.data.pokemon_id;
        this.pokestopId = data.nearby.data.fort_id;
        this.gender = data.nearby.data.pokemon_display.gender;
        this.form = data.nearby.data.pokemon_display.form;
        if (data.nearby.data.pokemon_display) {
            this.costume = data.nearby.data.pokemon_display.costume;
            this.weather = data.nearby.data.pokemon_display.weather_boosted_condition;
        }
        this.username = data.nearby.username;
        let pokestop;
        // TODO: Pokestops
        /*
        try {
            // TODO: Pokestops
            pokestop = await Pokestop.getById(data.nearby.data.fort_id);
        } catch (err) {
            pokestop = null;
            // TODO: Fix error
            console.error("[Pokemon] InitNearby Error: " + err);
        }
        */
        if (pokestop) {
            this.pokestopId = pokestop.id;
            this.lat = pokestop.lat;
            this.lon = pokestop.lon;
        }
        this.cellId = String(data.cell);
        this.expireTimestampVerified = false;
    }

    /**
     * Load all Pokemon.
     */
    static async getAll() {
        let sql = `
            SELECT id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv,
            move_1, move_2, gender, form, cp, level, weather, costume, weight, size, display_pokemon_id,
            pokestop_id, updated, first_seen_timestamp, changed, cell_id, expire_timestamp_verified,
            shiny, username
            FROM pokemon
            WHERE expire_timestamp >= UNIX_TIMESTAMP()
        `;
        let results = await query(sql)
            .then(x => x)
            .catch(err => {
                console.error("[Pokemon] Error: " + err);
                return null;
            });
        let keys = Object.values(results);
        if (keys.length === 0) {
            return null;
        }
        let pokemon = [];
        keys.forEach(key => {
            pokemon.push(new Pokemon({
                id: key.id,
                lat: key.lat,
                lon: key.lon,
                pokemon_id: key.pokemon_id,
                form: key.form,
                gender: key.gender,
                costume: key.costume,
                shiny: key.shiny,
                weather: key.weather,
                level: key.level,
                cp: key.cp,
                move1: key.move_1,
                move2: key.move_2,
                size: key.size,
                weight: key.weight,
                spawn_id: key.spawn_id,
                expire_timestamp: key.expire_timestamp,
                expire_timestamp_verified: key.expire_timestamp_verified,
                first_seen_timestamp: key.first_seen_timestamp,
                pokestop_id: key.pokestop_id,
                atk_iv: key.atk_iv,
                def_iv: key.def_iv,
                sta_iv: key.sta_iv,
                username: key.username,
                updated: key.updated,
                changed: key.changed,
                display_pokemon_id: key.display_pokemon_id,
                cell_id: key.cell_id
            }));
        });
        return pokemon;
    }

    /**
     * Get pokemon by pokemon encounter id.
     * @param encounterId 
     */
    static async getById(encounterId) {
        let sql = `
            SELECT id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv, move_1, move_2, gender, form, cp, level, weather, costume, weight, size, display_pokemon_id, pokestop_id, updated, first_seen_timestamp, changed, cell_id, expire_timestamp_verified, shiny, username
            FROM pokemon
            WHERE id = ?
            LIMIT 1
        `;
        let args = [encounterId.toString()];
        let results = await query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error("[Pokemon] Error: " + err);
                return null;
            });
        let keys = Object.values(results);
        if (keys.length === 0) {
            return null;
        }
        let pokemon;
        keys.forEach(key => {
            pokemon = new Pokemon({
                id: key.id,
                lat: key.lat,
                lon: key.lon,
                pokemon_id: key.pokemon_id,
                form: key.form,
                gender: key.gender,
                costume: key.costume,
                shiny: key.shiny,
                weather: key.weather,
                level: key.level,
                cp: key.cp,
                move1: key.move_1,
                move2: key.move_2,
                size: key.size,
                weight: key.weight,
                spawn_id: key.spawn_id,
                expire_timestamp: key.expire_timestamp,
                expire_timestamp_verified: key.expire_timestamp_verified,
                first_seen_timestamp: key.first_seen_timestamp,
                pokestop_id: key.pokestop_id,
                atk_iv: key.atk_iv,
                def_iv: key.def_iv,
                sta_iv: key.sta_iv,
                username: key.username,
                updated: key.updated,
                changed: key.changed,
                display_pokemon_id: key.display_pokemon_id,
                cell_id: key.cell_id
            });
        })
        return pokemon;
    }

    /**
     * Add Pokemon encounter proto data.
     * @param encounter 
     * @param username 
     */
    async addEncounter(encounter, username) {
        this.pokemonId = encounter.wild_pokemon.pokemon_data.pokemon_id;
        this.cp = encounter.wild_pokemon.pokemon_data.cp;
        this.move1 = encounter.wild_pokemon.pokemon_data.move1;
        this.move2 = encounter.wild_pokemon.pokemon_data.move2;
        this.size = encounter.wild_pokemon.pokemon_data.height_m;
        this.weight = encounter.wild_pokemon.pokemon_data.weight_kg;
        this.atkIv = encounter.wild_pokemon.pokemon_data.individual_attack;
        this.defIv = encounter.wild_pokemon.pokemon_data.individual_defense;
        this.staIv = encounter.wild_pokemon.pokemon_data.individual_stamina;
        this.costume = encounter.wild_pokemon.pokemon_data.pokemon_display.costume;
        this.shiny = encounter.wild_pokemon.pokemon_data.pokemon_display.shiny;
        this.username = username;
        this.form = encounter.wild_pokemon.pokemon_data.pokemon_display.form;
        this.gender = encounter.wild_pokemon.pokemon_data.pokemon_display.gender;
        let cpMultiplier = encounter.wild_pokemon.pokemon_data.cp_multiplier;
        let level;
        if (cpMultiplier < 0.734) {
            level = Math.round(58.35178527 * cpMultiplier * cpMultiplier - 2.838007664 * cpMultiplier + 0.8539209906);
        } else {
            level = Math.round(171.0112688 * cpMultiplier - 95.20425243);
        }
        this.level = level
        this.isDitto = Pokemon.isDittoDisguised(this.pokemonId,
                                                this.level || 0,
                                                this.weather || 0,
                                                this.atkIv || 0,
                                                this.defIv || 0,
                                                this.staIv || 0
        );
        if (this.isDitto) {
            console.log("[POKEMON] Pokemon", this.id, "Ditto found, disguised as", this.pokemonId);
            this.setDittoAttributes(this.pokemonId);
        }

        if (this.spawnId === undefined) {
            this.spawnId = parseInt(encounter.wild_pokemon.spawn_point_id, 16).toString();
            this.lat = encounter.wild_pokemon.latitude;
            this.lon = encounter.wild_pokemon.longitude;

            if (this.expireTimestampVerified === false && this.spawnId !== undefined) {
                let spawnpoint;
                // TODO: Spawnpoints
                /*
                try {
                    spawnpoint = await Spawnpoint.getById(this.spawnId);
                } catch (err) {
                    spawnpoint = null;
                }
                */
                if (spawnpoint instanceof Spawnpoint) {
                    let expireTimestamp = this.getDespawnTimer(spawnpoint, getCurrentTimestamp() * 1000);
                    if (expireTimestamp > 0) {
                        this.expireTimestamp = expireTimestamp;
                        this.expireTimestampVerified = true;
                    }
                }
            }
        }

        this.updated = getCurrentTimestamp();
        this.changed = this.updated;
    }

    /**
     * Set default Ditto attributes.
     * @param displayPokemonId 
     */
    setDittoAttributes(displayPokemonId) {
        let moveTransformFast = 242;
        let moveStruggle = 133;
        this.displayPokemonId = displayPokemonId;
        this.pokemonId = Pokemon.DittoPokemonId;
        this.form = 0;
        this.move1 = moveTransformFast;
        this.move2 = moveStruggle;
        this.gender = 3;
        this.costume = 0;
        this.size = 0;
        this.weight = 0;
    }

    /**
     * Check if Pokemon is Ditto disguised.
     * @param pokemon 
     */
    static isDittoDisguisedFromPokemon(pokemon) {
        let isDisguised = (pokemon.pokemonId == Pokemon.DittoPokemonId) || (DbController.DittoDisguises.includes(pokemon.pokemonId) || false);
        let isUnderLevelBoosted = pokemon.level > 0 && pokemon.level < Pokemon.WeatherBoostMinLevel;
        let isUnderIvStatBoosted = pokemon.level > 0 && (pokemon.atkIv < Pokemon.WeatherBoostMinIvStat || pokemon.defIv < Pokemon.WeatherBoostMinIvStat || pokemon.staIv < Pokemon.WeatherBoostMinIvStat);
        let isWeatherBoosted = pokemon.weather > 0;
        return isDisguised && (isUnderLevelBoosted || isUnderIvStatBoosted) && isWeatherBoosted;
    }

    /**
     * Check if Pokemon is Ditto disguised.
     * @param pokemonId 
     * @param level 
     * @param weather 
     * @param atkIv 
     * @param defIv 
     * @param staIv 
     */
    static isDittoDisguised(pokemonId, level, weather, atkIv, defIv, staIv) {
        let isDisguised = (pokemonId == Pokemon.DittoPokemonId) || (DbController.DittoDisguises.includes(pokemonId) || false);
        let isUnderLevelBoosted = level > 0 && level < Pokemon.WeatherBoostMinLevel;
        let isUnderIvStatBoosted = level > 0 && (atkIv < Pokemon.WeatherBoostMinIvStat || defIv < Pokemon.WeatherBoostMinIvStat || staIv < Pokemon.WeatherBoostMinIvStat);
        let isWeatherBoosted = weather > 0;
        return isDisguised && (isUnderLevelBoosted || isUnderIvStatBoosted) && isWeatherBoosted;
    }

    /**
     * Save Pokemon.
     * @param updateIV 
     */
    async save(updateIV = false) {
        let bindFirstSeen = false;
        let bindChangedTimestamp = false;

        this.updated = getCurrentTimestamp();
        let oldPokemon;
        try {
            oldPokemon = await Pokemon.getById(this.id);
        } catch (err) {
            oldPokemon = null;
        }
        let sql = "";
        let args = [];
        if (oldPokemon === null) {
            bindFirstSeen = false;
            bindChangedTimestamp = false;
            if (this.expireTimestamp === undefined || this.expireTimestamp === null) {
                this.expireTimestamp = getCurrentTimestamp() + Pokemon.PokemonTimeUnseen;
            }
            this.firstSeenTimestamp = this.updated;
            sql = `
                INSERT INTO pokemon (id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv, move_1, move_2, cp, level, weight, size, display_pokemon_id, shiny, username, gender, form, weather, costume, pokestop_id, updated, first_seen_timestamp, changed, cell_id, expire_timestamp_verified)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), ?, ?)
            `;
            args.push(this.id.toString());
        } else {
            bindFirstSeen = true;
            this.firstSeenTimestamp = oldPokemon.firstSeenTimestamp;
            if (this.expireTimestamp === undefined || this.expireTimestamp === null) {
                let now = getCurrentTimestamp();
                let oldExpireDate = oldPokemon.expireTimestamp;
                if ((oldExpireDate - now) < Pokemon.PokemonTimeReseen) {
                    this.expireTimestamp = getCurrentTimestamp() + Pokemon.PokemonTimeReseen;
                } else {
                    this.expireTimestamp = oldPokemon.expireTimestamp;
                }
            }
            if (this.expireTimestampVerified === false && oldPokemon.expireTimestampVerified) {
                this.expireTimestampVerified = oldPokemon.expireTimestampVerified;
                this.expireTimestamp = oldPokemon.expireTimestamp;
            }
            if (oldPokemon.pokemonId !== this.pokemonId) {
                if (oldPokemon.pokemonId !== Pokemon.DittoPokemonId) {
                    console.log("[POKEMON] Pokemon", this.id, "changed from", oldPokemon.pokemonId, "to", this.pokemonId);
                } else if (oldPokemon.displayPokemonId || 0 !== this.pokemonId) {
                    console.log("[POKEMON] Pokemon", this.id, "Ditto diguised as", (oldPokemon.displayPokemonId || 0), "now seen as", this.pokemonId);
                }
            }
            if (oldPokemon.cellId && (this.cellId === undefined || this.cellId === null)) {
                this.cellId = oldPokemon.cellId;
            }
            if (oldPokemon.spawnId && (this.spawnId === undefined || this.spawnId == null)) {
                this.spawnId = oldPokemon.spawnId;
                this.lat = oldPokemon.lat;
                this.lon = oldPokemon.lon;
            }
            if (oldPokemon.pokestopId && (this.pokestopId === undefined || this.pokestopId == null)) {
                this.pokestopId = oldPokemon.pokestopId;
            }

            let changedSQL
            if (updateIV && (oldPokemon.atkIv === undefined || oldPokemon.atkIv === null) && this.atkIv) {
                WebhookController.instance.addPokemonEvent(this);
                InstanceController.instance.gotIV(this);
                bindChangedTimestamp = false;
                changedSQL = "UNIX_TIMESTAMP()";
            } else {
                bindChangedTimestamp = true;
                this.changed = oldPokemon.changed;
                changedSQL = "?";
            }

            if (updateIV && oldPokemon.atkIv && (this.atkIv === undefined || this.atkIv === null)) {
                if (
                    !(((oldPokemon.weather === undefined || oldPokemon.weather === null) || oldPokemon.weather === 0) && (this.weather || 0 > 0) ||
                        ((this.weather === undefined || this.weather === null) || this.weather === 0) && (oldPokemon.weather || 0 > 0))
                ) {
                    this.atkIv = oldPokemon.atkIv;
                    this.defIv = oldPokemon.defIv;
                    this.staIv = oldPokemon.staIv;
                    this.cp = oldPokemon.cp;
                    this.weight = oldPokemon.weight;
                    this.size = oldPokemon.size;
                    this.move1 = oldPokemon.move1;
                    this.move2 = oldPokemon.move2;
                    this.level = oldPokemon.level;
                    this.shiny = oldPokemon.shiny;
                    this.isDitto = Pokemon.isDittoDisguisedFromPokemon(oldPokemon);
                    if (this.isDitto) {
                        console.log("[POKEMON] oldPokemon", this.id, "Ditto found, disguised as", this.pokemonId);
                        this.setDittoAttributes(this.pokemonId);
                    }
                }
            }

            let shouldWrite = Pokemon.shouldUpdate(oldPokemon, this);
            if (!shouldWrite) {
                return;
            }

            let ivSQL
            if (updateIV) {
                ivSQL = "atk_iv = ?, def_iv = ?, sta_iv = ?, move_1 = ?, move_2 = ?, cp = ?, level = ?, weight = ?, size = ?, shiny = ?, display_pokemon_id = ?,";
            } else {
                ivSQL = "";
            }

            if (oldPokemon.pokemonId === Pokemon.DittoPokemonId && this.pokemonId !== Pokemon.DittoPokemonId) {
                console.log("[POKEMON] Pokemon", this.id, "Ditto changed from", oldPokemon.pokemonId, "to", this.pokemonId);
            }
            sql = `
            UPDATE pokemon
            SET pokemon_id = ?, lat = ?, lon = ?, spawn_id = ?, expire_timestamp = ?, ${ivSQL} username = ?, gender = ?, form = ?, weather = ?, costume = ?, pokestop_id = ?, updated = UNIX_TIMESTAMP(), first_seen_timestamp = ?, changed = ${changedSQL}, cell_id = ?, expire_timestamp_verified = ?
            WHERE id = ?
            `;
        }

        args.push(this.pokemonId);
        args.push(this.lat);
        args.push(this.lon);
        args.push(this.spawnId || null);
        args.push(this.expireTimestamp);
        if (updateIV || (oldPokemon === undefined || oldPokemon === null)) {
            args.push(this.atkIv || null);
            args.push(this.defIv || null);
            args.push(this.staIv || null);
            args.push(this.move1 || null);
            args.push(this.move2 || null);
            args.push(this.cp || null);
            args.push(this.level || null);
            args.push(this.weight || null);
            args.push(this.size || null);
            args.push(this.shiny || null);
            args.push(this.displayPokemonId || null);
        }
        args.push(this.username || null);
        args.push(this.gender || 0);
        args.push(this.form || 0);
        args.push(this.weather || 0);
        args.push(this.costume || 0);
        args.push(this.pokestopId || null);
        if (bindFirstSeen) {
            args.push(this.firstSeenTimestamp);
        }
        if (bindChangedTimestamp) {
            args.push(this.changed || this.updated);
        }
        args.push(this.cellId || null);
        args.push(this.expireTimestampVerified);
        if (oldPokemon) {
            args.push(this.id);
        }
        if (this.spawnId) {
            let spawnpoint;
            if (this.expireTimestampVerified && this.expireTimestamp) {
                let date = moment(this.expireTimestamp).format('mm:ss');
                let split = date.split(':');
                let minute = parseInt(split[0]);
                let second = parseInt(split[1]);
                let secondOfHour = second + minute * 60;
                spawnpoint = new Spawnpoint({
                    id: this.spawnId,
                    lat: this.lat,
                    lon: this.lon,
                    updated: this.updated,
                    despawn_sec: secondOfHour
                });
            } else {
                spawnpoint = new Spawnpoint({
                    id: this.spawnId,
                    lat: this.lat,
                    lon: this.lon,
                    updated: this.updated,
                    despawn_sec: null
                });
            }
            try {
                await spawnpoint.save(true);
            } catch (err) {
                console.error("[Pokemon] Spawnpoint Error:", err);
            }
        }

        if (this.lat === undefined && this.pokestopId) {
            if (this.pokestopId) {
                let pokestop;
                try {
                    pokestop = await Pokestop.getById(this.pokestopId);
                } catch (err) {
                    console.error(err);
                }
                if (pokestop) {
                    this.lat = pokestop.lat;
                    this.lon = pokestop.lon;
                    if (oldPokemon) {
                        args[1] = this.lat;
                        args[2] = this.lon;
                    } else {
                        args[2] = this.lat;
                        args[3] = this.lon;
                    }
                } else {
                    return;
                }
            } else {
                return;
            }
        }

        // TODO: Error: ER_NO_REFERENCED_ROW_2: Cannot add or update a child row: a foreign key constraint fails (`rdmdb`.`pokemon`, CONSTRAINT `fk_pokemon_cell_id` FOREIGN KEY (`cell_id`) REFERENCES `s2cell` (`id`) ON DELETE CASCADE ON UPDATE CASCADE)
        await query(sql, args)
            .then(x => x)
            .catch(err => {
                console.log("[Pokemon] SQL:", sql);
                console.log("[Pokemon] Arguments:", args);
                console.error("[Pokemon] Error:", err);
                return null;
            });

        /*
        if (oldPokemon === undefined || oldPokemon === null) {
            WebhookController.instance.addPokemonEvent(this);
            InstanceController.instance.gotPokemon(this);
            if (this.atkIv) {
                InstanceController.instance.gotIV(this);
            }
        }
        */
    }

    /**
     * 
     * @param spawnpoint 
     * @param timestampMs 
     */
    getDespawnTimer(spawnpoint, timestampMs) {
        let despawnSecond = spawnpoint.despawnSecond;
        if (despawnSecond) {
            let ts = timestampMs.toString();
            let date = moment((parseInt(ts) / 1000));
            let dateFormat = date.format('mm:ss');
            let dateUnix = date.format('x');
            let split = dateFormat.split(':');
            let minute = parseInt(split[0]);
            let second = parseInt(split[1]);
            let secondOfHour = second + minute * 60;

            let despawnOffset;
            if (despawnSecond < secondOfHour) {
                despawnOffset = 3600 + despawnSecond - secondOfHour;
            } else {
                despawnOffset = despawnSecond - secondOfHour;
            }
            let despawn = parseInt(dateUnix) + despawnOffset;
            return despawn;
        }
    }
}

module.exports = Pokemon;