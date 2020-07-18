'use strict';

const moment = require('moment');

const config = require('../config.json');
const Cell = require('./cell.js');
const Pokestop = require('./pokestop.js');
const Spawnpoint = require('./spawnpoint.js');
const TaskFactory = require('../services/task-factory.js');
const WebhookController = require('../services/webhook-controller.js');
const MySQLConnector = require('../services/mysql.js');
const { getCurrentTimestamp, generateEncounterId } = require('../utilities/utils.js');

const db = new MySQLConnector(config.db.rdm);

class Pokemon {
    static DittoPokemonId = 132;
    static WeatherBoostMinLevel = 6;
    static WeatherBoostMinIvStat = 4;
    static PokemonTimeUnseen = 1200;
    static PokemonTimeReseen = 600;
    static DittoDisguises = [46,163,165,167,187,223,293,316,322,399,590];

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
    capture1;
    capture2;
    capture3;
    pvpRankingsGreatLeague;
    pvpRankingsUltraLeague;

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
            this.id = BigInt(data.id).toString();
            this.lat = data.lat;
            this.lon = data.lon;
            this.pokemonId = data.pokemon_id;
            this.form = data.form;
            this.level = data.level;
            this.costume = data.costume;
            this.weather = data.weather;
            this.gender = data.gender;
            this.spawnId = data.spawn_id ? BigInt(data.spawn_id).toString() : null;
            this.cellId = BigInt(data.cell_id).toString();
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
            this.capture1 = data.capture_1;
            this.capture2 = data.capture_2;
            this.capture3 = data.capture_3;
            this.pvpRankingsGreatLeague = data.pvp_rankings_great_league;
            this.pvpRankingsUltraLeague = data.pvp_rankings_ultra_league;
        }
    }

    async initWild(data) {
        this.id = data.wild.encounter_id.toString();
        //console.log('Wild Pokemon Data:', data.wild.pokemon_data);
        this.pokemonId = data.wild.pokemon_data.pokemon_id;
        if (data.wild.latitude === undefined || data.wild.latitude === null) {
            console.debug('[Pokemon] Wild Pokemon null lat/lon!');
        }
        this.lat = data.wild.latitude;
        this.lon = data.wild.longitude;
        let spawnId = BigInt(parseInt(data.wild.spawn_point_id, 16)).toString();
        this.gender = data.wild.pokemon_data.pokemon_display.gender;
        this.form = data.wild.pokemon_data.pokemon_display.form;
        if (data.wild.pokemon_data.pokemon_display) {
            this.costume = data.wild.pokemon_data.pokemon_display.costume;
            this.weather = data.wild.pokemon_data.pokemon_display.weather_boosted_condition;
        }
        this.username = data.wild.username;
        let currentTimestamp = getCurrentTimestamp() * 1000;
        if (data.wild.time_till_hidden_ms > 0 && data.wild.time_till_hidden_ms <= 90000) {
            this.expireTimestamp = Math.round(currentTimestamp / 1000 + data.wild.time_till_hidden_ms);
            this.expireTimestampVerified = true;
        } else {
            this.expireTimestampVerified = false;
        }
        if (!this.expireTimestampVerified && spawnId) {
            // Spawnpoint not verified, check if we have the tth.
            let spawnpoint = {};
            try {
                spawnpoint = await Spawnpoint.getById(spawnId);
            } catch (err) {
                spawnpoint = null;
            }
            if (spawnpoint instanceof Spawnpoint) {
                let expireTimestamp = this.getDespawnTimer(spawnpoint, currentTimestamp);
                if (expireTimestamp > 0) {
                    this.expireTimestamp = expireTimestamp;
                    this.expireTimestampVerified = true;
                }
            }
        }
        this.spawnId = spawnId;
        if (data.wild.cell === undefined || data.wild.cell === null) {
            data.wild.cell = Cell.getCellIdFromLatLon(this.lat, this.lon);
        } else {
            this.cellId = BigInt(data.wild.cell).toString();
        }
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
        try {
            pokestop = await Pokestop.getById(data.nearby.data.fort_id);
        } catch (err) {
            pokestop = null;
            console.error('[Pokemon] InitNearby Error:', err);
        }
        if (pokestop) {
            this.pokestopId = pokestop.id;
            this.lat = pokestop.lat;
            this.lon = pokestop.lon;
        }
        this.cellId = BigInt(data.nearby.cell).toString();
        this.expireTimestampVerified = false;
    }

    /**
     * Get pokemon by pokemon encounter id.
     * @param encounterId 
     */
    static async getById(encounterId) {
        let sql = `
            SELECT
                id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv,
                move_1, move_2, gender, form, cp, level, weather, costume, weight, size,
                display_pokemon_id, pokestop_id, updated, first_seen_timestamp, changed, cell_id,
                expire_timestamp_verified, shiny, username, capture_1, capture_2, capture_3,
                pvp_rankings_great_league, pvp_rankings_ultra_league
            FROM pokemon
            WHERE id = ?
            LIMIT 1
        `;
        let args = [encounterId.toString()];
        let results = await db.query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Pokemon] Error: ' + err);
                return null;
            });
        let keys = Object.values(results);
        if (keys.length === 0) {
            return null;
        }
        let pokemon;
        keys.forEach(key => {
            pokemon = new Pokemon({
                id: BigInt(key.id).toString(),
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
                spawn_id: key.spawn_id ? BigInt(key.spawn_id).toString() : null,
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
                cell_id: key.cell_id ? BigInt(key.cell_id).toString() : null,
                capture1: key.capture_1,
                capture2: key.capture_2,
                capture3: key.capture_3,
                pvpRankingsGreatLeague: key.pvp_rankings_great_league,
                pvpRankingsUltraLeague: key.pvp_rankings_ultra_league,
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
        this.move1 = encounter.wild_pokemon.pokemon_data.move_1;
        this.move2 = encounter.wild_pokemon.pokemon_data.move_2;
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
        if (encounter.capture_probability) {
            this.capture1 = parseFloat(encounter.capture_probability.capture_probability[0])
            this.capture2 = parseFloat(encounter.capture_probability.capture_probability[1])
            this.capture3 = parseFloat(encounter.capture_probability.capture_probability[2])
        }
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
            console.log('[POKEMON] Pokemon', this.id, 'Ditto found, disguised as', this.pokemonId);
            this.setDittoAttributes(this.pokemonId);
        }

        if (this.spawnId === undefined) {
            this.spawnId = BigInt(parseInt(encounter.wild_pokemon.spawn_point_id, 16)).toString();//parseInt(encounter.wild_pokemon.spawn_point_id, 16).toString();
            this.lat = encounter.wild_pokemon.latitude;
            this.lon = encounter.wild_pokemon.longitude;

            if (this.expireTimestampVerified === false && this.spawnId !== undefined) {
                let spawnpoint;
                try {
                    spawnpoint = await Spawnpoint.getById(this.spawnId);
                } catch (err) {
                    spawnpoint = null;
                }
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
        let isDisguised = (pokemon.pokemonId == Pokemon.DittoPokemonId) || (Pokemon.DittoDisguises.includes(pokemon.pokemonId) || false);
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
        let isDisguised = (pokemonId == Pokemon.DittoPokemonId) || (Pokemon.DittoDisguises.includes(pokemonId) || false);
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
        let sql = '';
        let args = [];
        if (oldPokemon === null) {
            bindFirstSeen = false;
            bindChangedTimestamp = false;
            if (this.expireTimestamp === undefined || this.expireTimestamp === null) {
                this.expireTimestamp = getCurrentTimestamp() + Pokemon.PokemonTimeUnseen;
            }
            this.firstSeenTimestamp = this.updated;
            sql = `
                INSERT INTO pokemon (id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv, move_1, move_2, cp, level, weight, size, display_pokemon_id, shiny, username, gender, form, weather, costume, pokestop_id, updated, first_seen_timestamp, changed, cell_id, expire_timestamp_verified, capture_1, capture_2, capture_3, pvp_rankings_great_league, pvp_rankings_ultra_league)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?)
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
                    console.log('[POKEMON] Pokemon', this.id, 'changed from', oldPokemon.pokemonId, 'to', this.pokemonId);
                    if (config.requeueWeatherChanged) {
                        // Re-queue weather/event changed spawns
                        TaskFactory.instance.enqueue(this.toJson());
                    }
                    
                } else if (oldPokemon.displayPokemonId || 0 !== this.pokemonId) {
                    console.log('[POKEMON] Pokemon', this.id, 'Ditto diguised as', (oldPokemon.displayPokemonId || 0), 'now seen as', this.pokemonId);
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
                bindChangedTimestamp = false;
                changedSQL = 'UNIX_TIMESTAMP()';
            } else {
                bindChangedTimestamp = true;
                this.changed = oldPokemon.changed;
                changedSQL = '?';
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
                        console.log('[POKEMON] oldPokemon', this.id, 'Ditto found, disguised as', this.pokemonId);
                        this.setDittoAttributes(this.pokemonId);
                    }
                }
            }

            let ivSQL
            if (updateIV) {
                ivSQL = 'atk_iv = ?, def_iv = ?, sta_iv = ?, move_1 = ?, move_2 = ?, cp = ?, level = ?, weight = ?, size = ?, shiny = ?, display_pokemon_id = ?,';
            } else {
                ivSQL = '';
            }

            if (oldPokemon.pokemonId === Pokemon.DittoPokemonId && this.pokemonId !== Pokemon.DittoPokemonId) {
                console.log('[POKEMON] Pokemon', this.id, 'Ditto changed from', oldPokemon.pokemonId, 'to', this.pokemonId);
            }
            sql = `
            UPDATE pokemon
            SET pokemon_id = ?, lat = ?, lon = ?, spawn_id = ?, expire_timestamp = ?, ${ivSQL} username = ?, gender = ?, form = ?, weather = ?, costume = ?, pokestop_id = ?, updated = UNIX_TIMESTAMP(), first_seen_timestamp = ?, changed = ${changedSQL}, cell_id = ?, expire_timestamp_verified = ?, capture_1 = ?, capture_2 = ?, capture_3 = ?
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
        args.push(this.capture1);
        args.push(this.capture2);
        args.push(this.capture3);
        args.push(this.pvpRankingsGreatLeague);
        args.push(this.pvpRankingsUltraLeague);
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
                spawnpoint = new Spawnpoint(
                    this.spawnId,
                    this.lat,
                    this.lon,
                    secondOfHour,
                    this.updated
                );
            } else {
                spawnpoint = new Spawnpoint(
                    this.spawnId,
                    this.lat,
                    this.lon,
                    null,
                    this.updated
                );
            }
            try {
                await spawnpoint.save(true);
            } catch (err) {
                console.error('[Pokemon] Spawnpoint Error:', err);
            }
        }

        await db.query(sql, args)
            .then(x => x)
            .catch(err => {
                console.log('[Pokemon] SQL:', sql);
                console.log('[Pokemon] Arguments:', args);
                console.error('[Pokemon] Error:', err);
                return null;
            });

        if (oldPokemon === undefined || oldPokemon === null) {
            WebhookController.instance.addPokemonEvent(this);
        }
    }

    /**
     * Calculate despawn timer of spawnpoint
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

    /**
     * Get Pokemon as JSON message for webhook payload
     */
    toJson() {
        // Get pvp stats from PVP cache if IV stats are the same
        let pvpRanks = TaskFactory.pvpCache.filter(x => x.encounter_id === this.id &&
                                                        x.individual_attack === this.atkIv &&
                                                        x.individual_defense === this.defIv &&
                                                        x.individual_stamina === this.staIv);
        //console.log('PvP Ranks:', pvpRanks.length);
        return {
            type: 'pokemon',
            message: {
                spawnpoint_id: this.spawnId ? this.spawnId.toString(16) : 'None',
                pokestop_id: this.pokestopId || 'None',
                encounter_id: config.randomizeEncounter ? generateEncounterId() : this.id,
                pokemon_id: this.pokemonId,
                latitude: this.lat,
                longitude: this.lon,
                disappear_time: this.expireTimestamp || 0,
                disappear_time_verified: this.expireTimestampVerified,
                first_seen: this.firstSeenTimestamp || 1,
                last_modified_time: this.updated || 1,
                gender: this.gender,
                cp: this.cp,
                form: this.form,
                costume: this.costume,
                individual_attack: this.atkIv,
                individual_defense: this.defIv,
                individual_stamina: this.staIv,
                pokemon_level: this.level,
                move_1: this.move1,
                move_2: this.move2,
                weight: this.weight,
                height: this.size,
                weather: this.weather,
                shiny: this.shiny,
                username: this.username,
                display_pokemon_id: this.displayPokemonId,
                capture_1: this.capture1,
                capture_2: this.capture2,
                capture_3: this.capture3,
                pvp_rankings_great_league: this.pvpRankingsGreatLeague || pvpRanks ? pvpRanks.pvp_rankings_great_league : null,
                pvp_rankings_ultra_league: this.pvpRankingsUltraLeague || pvpRanks ? pvpRanks.pvp_rankings_ultra_league : null,
                is_event: true
            }
        }
    }
}

module.exports = Pokemon;