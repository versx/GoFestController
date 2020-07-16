'use strict';

// TODO: Redis caching for incoming webhooks for pvp data if needed?
// TODO: Priority per IV
// TODO: Config option to randomize encounter_id after recheck

const express = require('express');
const app = express();
const helmet = require('helmet');

const config = require('./config.json');
const RouteController = require('./services/route-controller.js');
const WebhookController = require('./services/webhook-controller.js');

const router = new RouteController();

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
app.get(['/controler', '/controller'], router.handleControllerData);
app.post(['/controler', '/controller'], router.handleControllerData);

app.get('/raw', router.handleRawData);
app.post('/raw', router.handleRawData);

app.get('/', router.handleWebhookData);
app.post('/', router.handleWebhookData);

app.get('/tasks', router.handleTasksData);

/*
app.post('/test', (req, res) => {
    console.log('Received', req.body.length, 'webhooks from GoFestController');
    console.log('Payload:', req.body);
    res.send('OK');
});
*/

// Start listener
app.listen(config.port, config.interface, () => console.log(`Listening on port ${config.port}...`));

if (config.webhooks.enabled) {
    WebhookController.instance.start();
}