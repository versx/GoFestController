'use strict';

const getCurrentTimestamp = () => {
    let now = new Date().getTime() / 1000;
    return Math.round(now);
};

/**
 * Base64 decodes the string to raw data.
 * @param {*} data 
 */
const base64_decode = (data) => {
    return Buffer.from(data, 'base64');
};

const sendResponse = (res, status, data) => {
    res.json({
        status: status,
        data: data
    });
};

const generateEncounterId = () => {
    const id = Math.floor(10000000000000000000 + Math.random() * 90000000000000000000);
    return id;
};

module.exports = {
    getCurrentTimestamp,
    base64_decode,
    sendResponse,
    generateEncounterId
};