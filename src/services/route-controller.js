'use strict';

const POGOProtos = require('pogo-protos');
//const POGOProtos = require('../POGOProtos.Rpc_pb.js');

const config = require('../config.json');
const { GeofenceService, Geofence } = require('./geofence.js');
const Account = require('../models/account.js');
const Device = require('../models/device.js');
const Pokemon = require('../models/pokemon.js');
const TaskFactory = require('./task-factory.js');
const { getCurrentTimestamp, base64_decode, sendResponse } = require('../utilities/utils.js');

const levelCache = {};

class RouteController {
    constructor() {
    }

    /**
     * Handle incoming device /controler data
     * @param {*} req 
     * @param {*} res 
     */
    async handleControllerData(req, res) {
        let payload = req.body;
        let type = payload['type'];
        let uuid = payload['uuid'];
        if (type === undefined || type === null ||
            uuid === undefined || uuid === null) {
            console.error('[Controller] Failed to parse controller data');
            return res.sendStatus(400);
        }
        //let username = payload['username'];
        let minLevel = config.minLevel || 35;
        let maxLevel = config.maxLevel || 40;
        let device = await Device.getById(uuid);

        console.log('[Controller]', uuid, 'received control request:', type);

        switch (type) {
            case 'init':
                let firstWarningTimestamp;
                if (device === undefined || device.accountUsername === undefined) {
                    firstWarningTimestamp = null;
                } else {
                    let account = await Account.getWithUsername(device.accountUsername, true);
                    if (account instanceof Account) {
                        firstWarningTimestamp = account.firstWarningTimestamp;
                    } else {
                        firstWarningTimestamp = null;
                    }
                }
                if (device instanceof Device) {
                    // Device is already registered
                    console.log('[Controller] Device already registered');
                    sendResponse(res, 'ok', {
                        assigned: device.instanceName !== undefined && device.instanceName !== null && device.instanceName !== '',
                        first_warning_timestamp: firstWarningTimestamp || 0
                    });
                } else {
                    // Register new device
                    console.log('[Controller] Registering device');
                    let newDevice = new Device(uuid, config.instanceName, null, null, getCurrentTimestamp(), 0.0, 0.0);
                    await newDevice.create();
                    sendResponse(res, 'ok', {
                        assigned: false,
                        first_warning_timestamp: firstWarningTimestamp
                    });
                }
                break;
            case 'heartbeat':
                let client = req.socket;
                let host = client 
                    ? `${client.remoteAddress}:${client.remotePort}` 
                    : '?';
                try {
                    await Device.touch(uuid, host, false);
                    sendResponse(res, 'ok', null);
                } catch (err) {
                    res.send(err);
                }
                break;
            case 'get_job':
                if (device && device.accountUsername) {
                    let account = await Account.getWithUsername(device.accountUsername, true);
                    if (account instanceof Account) {
                        let task = TaskFactory.instance.getTask();
                        if (task) {
                            console.log('[Controller] Sending job to check filtered IV at', task.lat, task.lon, 'for uuid', uuid);
                            sendResponse(res, 'ok', task);
                        } else {
                            console.warn('[Controller] No tasks available yet for uuid', uuid);
                        }
                    } else {
                        console.log('[Controller] Device', uuid, 'not logged into event account, logging out...');
                        sendResponse(res, 'ok', {
                            'action': 'switch_account',
                            'min_level': minLevel,
                            'max_level': maxLevel
                        });
                    }
                } else {
                    console.log('[Controller] Device', uuid, 'not assigned any account, switching accounts...');
                    sendResponse(res, 'ok', {
                        'action': 'switch_account',
                        'min_level': minLevel,
                        'max_level': maxLevel
                    });
                }
                break;
            case 'get_account':
                let account = await Account.getNewAccount(minLevel, maxLevel, true);
                console.log('[Controller] GetAccount:', account);
                if (device === undefined || device === null || 
                    account === undefined || account === null) {
                    console.error('[Controller] Failed to get event account, device or account is null.');
                    return res.sendStatus(400);
                }
                if (device.accountUsername) {
                    let oldAccount = await Account.getWithUsername(device.accountUsername, true);
                    if (oldAccount instanceof Account && 
                        oldAccount.hasTicket &&
                        oldAccount.level >= minLevel &&
                        oldAccount.level <= maxLevel &&
                        oldAccount.firstWarningTimestamp === undefined && 
                        oldAccount.failed                === undefined && 
                        oldAccount.failedTimestamp       === undefined) {
                        sendResponse(res, 'ok', {
                            username: oldAccount.username.trim(),
                            password: oldAccount.password.trim(),
                            first_warning_timestamp: oldAccount.firstWarningTimestamp,
                            level: oldAccount.level
                        });
                        return;
                    }
                }

                if (!account.hasTicket) {
                    console.error('[Controller] Failed to get event account, make sure you have enough!');
                    return res.sendStatus(404);
                }
                device.accountUsername = account.username;
                device.deviceLevel = account.level;
                await device.save(device.uuid);
                sendResponse(res, 'ok', {
                    username: account.username.trim(),
                    password: account.password.trim(),
                    first_warning_timestamp: account.firstWarningTimestamp,
                    level: account.level
                });
                break;
            case 'account_banned':
                let banAccount = await Account.getWithUsername(device.accountUsername, true);
                if (banAccount instanceof Account) {
                    if (banAccount.failedTimestamp === undefined || banAccount.failedTimestamp === null || 
                        banAccount.failed === undefined || banAccount.failed === null) {
                            banAccount.failedTimestamp = getCurrentTimestamp();
                            banAccount.failed = 'banned';
                            await banAccount.save(true);
                            sendResponse(res, 'ok', null);
                    }
                } else {
                    if (device === undefined || device === null ||
                        banAccount === undefined || banAccount === null) {
                        console.error('[Controller] Failed to get account, device or account is null.');
                        return res.sendStatus(400);
                    }
                }
                break;
            case 'account_warning':
                let warnAccount = await Account.getWithUsername(device.accountUsername, true);
                if (warnAccount instanceof Account) {
                    if (warnAccount.firstWarningTimestamp === undefined || warnAccount.firstWarningTimestamp === null) {
                        warnAccount.firstWarningTimestamp = getCurrentTimestamp();
                        await warnAccount.save(true);
                        sendResponse(res, 'ok', null);
                    }
                } else {
                    if (device === undefined || device === null ||
                        warnAccount === undefined || warnAccount === null) {
                        console.error('[Controller] Failed to get account, device or account is null.');
                        return res.sendStatus(400);
                    }
                }
                break;
            case 'account_invalid_credentials':
                let invalidAccount = await Account.getWithUsername(device.accountUsername, true);
                if (invalidAccount instanceof Account) {
                    if (invalidAccount.failedTimestamp === undefined || invalidAccount.failedTimestamp === null || 
                        invalidAccount.failed === undefined || invalidAccount.failed === null) {
                            invalidAccount.failedTimestamp = getCurrentTimestamp();
                            invalidAccount.failed = 'invalid_credentials';
                            await invalidAccount.save(true);
                            sendResponse(res, 'ok', null);
                    }
                } else {
                    if (device === undefined || device === null ||
                        invalidAccount === undefined || invalidAccount === null) {
                        console.error('[Controller] Failed to get account, device or account is null.');
                        return res.sendStatus(400);
                    }
                }
                break;
            case 'logged_out':
                try {
                    let device = await Device.getById(uuid);
                    if (device instanceof Device) {
                        if (device.accountUsername === null) {
                            return res.sendStatus(404);
                        }
                        device.accountUsername = null;
                        await device.save(device.uuid);
                        sendResponse(res, 'ok', null);
                    } else {
                        return res.sendStatus(404);
                    }
                } catch {
                    return res.sendStatus(500);
                }
                break;
            case 'job_failed':
                sendResponse(res, 'ok', null);
                break;
            default:
                console.error('[Controller] Unhandled Request:', type);
                return res.sendStatus(404);
        }
    }

    /**
     * Handle incoming /raw data
     * @param {*} req 
     * @param {*} res 
     */
    async handleRawData(req, res) {
        let json = req.body;
        if (json === undefined || json === null) {
            console.error('[Raw] Bad data');
            return res.sendStatus(400);
        }
        if (json['payload']) {
            json['contents'] = [json];
        }
    
        let trainerLevel = parseInt(json['trainerlvl'] || json['trainerLevel']) || 0;
        let username = json['username'];
        if (username && trainerLevel > 0) {
            let oldLevel = levelCache[username];
            if (oldLevel !== trainerLevel) {
                await Account.setLevel(username, trainerLevel);
                levelCache[username] = trainerLevel;
            }
        }
        let contents = json['contents'] || json['protos'] || json['gmo'];
        if (contents === undefined || contents === null) {
            console.error('[Raw] Invalid GMO');
            return res.sendStatus(400);
        }
        let uuid = json['uuid'];
        let latTarget = json['lat_target'];
        let lonTarget = json['lon_target'];
        if (uuid && latTarget && lonTarget) {
            try {
                await Device.setLastLocation(uuid, latTarget, lonTarget);
            } catch (err) {
                console.error('[Raw] Error:', err);
            }
        }

        let encounters = [];
        let isMadData = false;
    
        for (let i = 0; i < contents.length; i++) {
            const rawData = contents[i];
            let data = {};
            let method = 0;
            if (rawData['data']) {
                data = rawData['data'];
                method = parseInt(rawData['method']) || 106;
            } else if (rawData['payload']) {
                data = rawData['payload'];
                method = parseInt(rawData['type']) || 106;
                isMadData = true;
                username = 'PogoDroid';
            } else {
                console.error('[Raw] Unhandled proto:', rawData);
                return res.sendStatus(400);
            }
    
            switch (method) {
                case 2: // GetPlayerResponse
                case 4: // GetHoloInventoryResponse
                case 101: // FortSearchResponse
                case 104: // FortDetailsResponse
                case 106: // GetMapObjectsResponse
                case 156: // GymGetInfoResponse
                    break;
                case 102: // EncounterResponse
                    if (trainerLevel >= 30 || isMadData !== false) {
                        try {
                            let er = POGOProtos.Networking.Responses.EncounterResponse.decode(base64_decode(data));
                            if (er) {
                                encounters.push(er);
                            } else {
                                console.error('[Raw] Malformed EncounterResponse');
                            }
                        } catch (err) {
                            console.error('[Raw] Unable to decode EncounterResponse');
                        }
                    }
                    break;
                default:
                    console.error('[Raw] Invalid method provided:', method);
                    return;
            }
        }
    
        if (encounters.length > 0) {
            console.log('[Raw] Found:', encounters.length, 'Pokemon encounters at', latTarget, lonTarget);
        }
    
        setImmediate(async () => { await RouteController.handleConsumables(encounters, username); });
        sendResponse(res, 'ok', null);
    }

    /**
     * Handle incoming webhook data
     * @param {*} req 
     * @param {*} res 
     */
    async handleWebhookData(req, res) {
        let payload = req.body;
        // Fix for mapjs scout, can't send as an array for some reason
        if (payload.length === undefined) {
            payload = [payload];
        }
        if (payload.length > 0) {
            let filtered = payload.filter(x => {
                let geofence = GeofenceService.instance.getGeofence(x.message.latitude, x.message.longitude);
                return x.type === 'pokemon' &&
                    matchesIVFilter(x.message.individual_attack, x.message.individual_defense, x.message.individual_stamina) &&
                    (
                        // No geofence names specified means no area restrictions
                        // or if geofence is not null and is in allowed areas
                        config.geofences.length === 0 || (geofence !== null && config.geofences.length > 0 ? config.geofences.includes(geofence.name || 'Unknown') : false)
                    )
            });
            if (filtered.length > 0) {
                console.log('[Webhook] Filtered Pokemon Received:', filtered.length);
                for (let i = 0; i < filtered.length; i++) {
                    TaskFactory.instance.enqueue(filtered[i]);
                }
            }
        }
        res.send('OK');
    }

    /**
     * Handle tasks/jobs data
     * @param {*} req 
     * @param {*} res 
     */
    async handleTasksData(req, res) {
        const tasks = TaskFactory.instance.getAll();
        let html = `
        <style>
        table, td {
            border: 1px solid black;
            border-collapse: collapse;
        }
        th {
            border: 1px solid white;
            border-collapse: collapse;
        }
        table {
            border-spacing: 5px;
        }
        th, td {
            padding: 15px;
            vertical-align: middle;
            horizontal-align: middle;
            text-align: center;
        }
        </style>
        <table style='width:100%'>
          <caption><h2><b>Available Tasks: ${tasks.length}</b></h2></caption>
          <tr style='background: rgb(33, 37, 41); color: white;'>
            <th>#</th>
            <th>Encounter</th>
            <th>Pokemon</th>
            <th>Form</th>
            <th>Stats</th>
            <th>Expires</th>
            <th>Location</th>
          </tr>
        `;
        for (let i = 0; i < tasks.length; i++) {
            let task = tasks[i];
            html += `
            <tr>
              <td>${i + 1}</td>
              <td>${task.encounter_id}</td>
              <td>${task.pokemon_id}</td>
              <td>${task.form}</td>
              <td>${task.individual_attack}/${task.individual_defense}/${task.individual_stamina}</td>
              <td>${new Date(task.disappear_time * 1000).toLocaleString()}</td>
              <td>${task.latitude}, ${task.longitude}</td>
            </tr>
            `;
        }
        html += '</table>';
        res.send(html);
    }

    /**
     * Handle consumable items
     * @param {*} encounters 
     * @param {*} username 
     */
    static async handleConsumables(encounters, username) {
        if (encounters.length > 0) {
            //console.log('[Raw] Encounters:', encounters);
            // We only really care about encounters
            for (let i = 0; i < encounters.length; i++) {
                const encounter = encounters[i];
                const pkmn = await Pokemon.getById(BigInt(encounter.wild_pokemon.encounter_id).toString());
                if (pkmn instanceof Pokemon) {
                    await pkmn.addEncounter(encounter, username);
                    await pkmn.save(true);
                    //WebhookController.instance.addPokemonEvent(pkmn);
                } else {
                    let newPokemon = new Pokemon({ wild: encounter.wild_pokemon });
                    await newPokemon.addEncounter(encounter, username);
                    await newPokemon.save(true);
                    //WebhookController.instance.addPokemonEvent(newPokemon);
                }
            }
        }
    }
}

const matchesIVFilter = (atk, def, sta) => {
    let filters = config.filters;
    let result = false;
    let atkIV = parseInt(atk);
    let defIV = parseInt(def);
    let staIV = parseInt(sta);
    for (let i = 0; i < filters.length; i++) {
        let filter = filters[i];
        if (filter.atk === atkIV && filter.def === defIV && filter.sta === staIV) {
            result = true;
            break;
        }
    }
    return result;
}

module.exports = RouteController;