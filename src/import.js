'use strict';

const fs = require('fs');
const Account = require('./models/account.js');

const readFile = async (path) => {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(data);
        });
    });
};

const importAccounts = async (path) => {
    let data = await readFile(path);
    let accountData = data.split('\n');
    for (let i = 0; i < accountData.length; i++) {
        let accountLine = accountData[i].split(',');
        if (accountLine.length == 2) {
            let account = new Account(
                accountLine[0].trim(),
                accountLine[1].trim(),
                null,
                null,
                null,
                30,
                null,
                null,
                null,
                1
            );
            console.log('Importing account', accountLine[0]);
            await account.save(false);
        }
    }
};

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Error: Not accounts file provided via command line arguments.');
    return;
}
const path = args[0];
if (!fs.existsSync(path)) {
    console.error('Error: Accounts file does not exist:', path);
    return;
}
importAccounts(path)
    .then(x => x)
    .catch(err => {
        console.error('Failed to import accounts:', err);
    });