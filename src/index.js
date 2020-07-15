'use strict';

// TODO: Do something with parsed incoming raw data (wild/nearby/encounters, db/webhook)
// TODO: Pokestop, S2Cell model class
// TODO: Redis caching for task list/webhooks
// TODO: Priority per IV
// TODO: Pokemon PvP stats and capture rates in webhook events

const express = require('express');
const app = express();
const helmet = require('helmet');

const config = require('./config.json');
const routes = require('./routes.js');

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// TODO: Add config option
// app.set('trust proxy', 1);

// Basic security protection middleware
app.use(helmet());

// Body parser middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/', routes);

// Start listener
app.listen(config.port, config.interface, () => console.log(`Listening on port ${config.port}...`));