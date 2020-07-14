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

module.exports = {
    getCurrentTimestamp,
    base64_decode,
    sendResponse
};