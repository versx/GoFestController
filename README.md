# GoFestController  

Backend to facilitate re-checking a Pokemon spawn with an event ticket account.  


## Prerequisites  
- [RealDeviceMap](https://github.com/realdevicemap/realdevicemap) instance  
- Run the following against your RealDeviceMap database account table:
```sql
ALTER TABLE `account`
ADD COLUMN `has_ticket` tinyint(1) unsigned NOT NULL DEFAULT 0;
```


## Installation  
1.) Clone respository: `git clone https://github.com/versx/GoFestController`  
2.) Change directory to cloned folder: `cd GoFestController`  
3.) Install dependencies: `npm install`  
4.) Create config from example: `cp src/config.example.json src/config.json`  
5.) Edit/fill out config: `vi src/config.json`
6.) Start `npm run start`  


## Configuration  
```js
{
    // Host interface to listen on
    "interface": "0.0.0.0",
    // Listening port for backend
    "port": 5150,
    // Minimum account level to use
    "minLevel": 30,
    // Maximum account level to use
    "maxLevel": 40,
    // Instance name
    "instanceName": "GoFest-Test",
    // Custom IV filter list to re-check Pokemon against
    "filters": [
        { "atk": 15, "def": 15, "sta": 15 },
        { "atk": 0, "def": 15, "sta": 15 },
        { "atk": 0, "def": 15, "sta": 14 },
        { "atk": 0, "def": 14, "sta": 15 },
        { "atk": 0, "def": 14, "sta": 14 },
        { "atk": 1, "def": 15, "sta": 15 },
        { "atk": 1, "def": 15, "sta": 14 },
        { "atk": 1, "def": 14, "sta": 15 },
        { "atk": 1, "def": 14, "sta": 14 },
        { "atk": 0, "def": 0,  "sta": 0 }
    ],
    // RealDeviceMap database
    "db": {
        // Database IP address/FQDN
        "host": "127.0.0.1",
        // Database listening port
        "port": 3306,
        // Database account username
        "username": "user123",
        // Database account password
        "password": "pass123",
        // Database name
        "database": "rdmdb",
        // Database character set
        "charset": "utf8mb4"
    },
    // Relay webhook
    "webhooks": {
        // Set to true to enable webhook relays for rechecked Pokemon
        "enabled": false,
        // Webhook endpoint to send payload to
        "urls": [],
        // Delay before sending next webhook payload
        "delay": 5
    }
}
```