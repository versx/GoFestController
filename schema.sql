CREATE TABLE IF NOT EXISTS `account` (
    `username` varchar(32) NOT NULL,
    `password` varchar(32) NOT NULL,
    `first_warning_timestamp` int(11) unsigned DEFAULT NULL,
    `failed_timestamp` int(11) unsigned DEFAULT NULL,
    `failed` varchar(32) DEFAULT NULL,
    `level` tinyint(3) unsigned NOT NULL DEFAULT 0,
    `last_encounter_lat` double(18,14) DEFAULT NULL,
    `last_encounter_lon` double(18,14) DEFAULT NULL,
    `last_encounter_time` int(11) unsigned DEFAULT NULL,
    `has_ticket` tinyint(3) unsigned DEFAULT 0,
    PRIMARY KEY (`username`)
);

CREATE TABLE IF NOT EXISTS `device` (
    `uuid` varchar(40) NOT NULL,
    `instance_name` varchar(30) DEFAULT NULL,
    `last_host` varchar(30) DEFAULT NULL,
    `last_seen` int(11) unsigned NOT NULL DEFAULT 0,
    `account_username` varchar(32) DEFAULT NULL,
    `last_lat` double DEFAULT 0,
    `last_lon` double DEFAULT 0,
    PRIMARY KEY (`uuid`),
    UNIQUE KEY `uk_iaccount_username` (`account_username`),
    CONSTRAINT `fk_account_username` FOREIGN KEY (`account_username`) REFERENCES `account` (`username`) ON DELETE SET NULL ON UPDATE CASCADE
 );

CREATE TABLE IF NOT EXISTS `metadata` (
    `key` varchar(50) PRIMARY KEY NOT NULL,
    `value` varchar(50) DEFAULT NULL
);

INSERT IGNORE INTO `metadata` (`key`, `value`) VALUES ('DB_VERSION', 1);