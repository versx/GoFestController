'use strict';

// TODO: Parse encounters
// TODO: Allow specific list of IV filters
// TODO: Only grab accounts that have has_ticket column flag
// TODO: Do something with parsed incoming raw data (db/webhook)
// TODO: Pokemon model class
// TODO: Redis caching for 100s

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