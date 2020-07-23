'use strict';

const axios = require('axios');
//const request = require('request');
const config = require('../config.json');
const WebhookRelayInterval = 1000;

/**
 * WebhookController relay class.
 */
class WebhookController {
    static instance = new WebhookController(config.webhooks.urls, config.webhooks.delay);

    urls;
    delay;
    pokemonEvents;
    timer;

    constructor(urls, delay = 5) {
        console.info('[WebhookController] Starting up...');
        this.urls = urls;
        this.delay = delay;
        this.pokemonEvents = [];
    }

    start() {
        this.timer = setInterval(() => this.loopEvents(), this.delay * WebhookRelayInterval);
    }

    stop() {
        clearInterval(this.timer);
    }

    addPokemonEvent(pokemon) {
        if (this.urls.length > 0) {
            this.pokemonEvents.push(pokemon);
            //this.pokemonEvents[pokemon.id] = pokemon.toJson();
        }
    }

    loopEvents() {
        if (this.urls && this.urls.length > 0) {
            let events = [];
            if (this.pokemonEvents.length > 0) {
                let pokemonEvent = this.pokemonEvents.pop()
                events.push(pokemonEvent.toJson());
            }
            if (events.length > 0) {
                this.urls.forEach(url => this.sendEvents(events, url));
            }
        }
    }

    sendEvents(events, url) {
        if (events === undefined || events === null) {
            return;
        }
        let options = {
            url: url,
            method: 'POST',
            data: events,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'User-Agent': 'GoFestController'
            }
        };
        axios(options)
            .then(x => console.log('[WebhookController] Webhook event with', events.length, 'payloads sent to', url))
            .catch(err => {
                if (err) {
                    console.error('[WebhookController] Error occurred, trying again:', err);
                    this.sendEvents(events, url);
                    return;
                }
            });
        /*
        let options = {
            url: url,
            method: 'POST',
            json: true,
            body: events,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'User-Agent': 'GoFestController'
            }
        };
        request(options, (err, res, body) => {
            if (err) {
                console.error('[WebhookController] Error:', err);
                return;
            }
            //console.debug('[WebhookController] Response:', body);
            console.log("[WebhookController] Webhook event with", events.length, "payloads sent to", url);
        });
        */
    }
}

module.exports = WebhookController;