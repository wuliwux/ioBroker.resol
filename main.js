/**
 *
 * resol adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "resol",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js resol Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@resol.com>"
 *          ]
 *          "desc":         "resol adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {
 *       "IP": "10.0.0.150",
 *       "Port": 7053
	},
 *  }
 *
 */

/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
"use strict";

var vbus = require('resol-vbus');
var _ = require('lodash');

//var i18n = new vbus.I18N('en');
var spec = vbus.Specification.getDefaultSpecification();
// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils

var ctx = {
    headerSet: null,
    hsc: null,
    connection: null,
};

var adapter;

function startAdapter(options) {
    options = options || {};

    // you have to call the adapter function and pass a options object
    // name has to be set and has to be equal to adapters folder name and main file name excluding extension
    // adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.resol.0
    adapter = utils.adapter('resol');

    // is called when adapter shuts down - callback has to be called under any circumstances!
    adapter.on('unload', function (callback) {
        try {
            ctx.connection.disconnectd();
            callback();
        } catch (e) {
            callback();
        }
    });

    // is called if a subscribed object changes
    adapter.on('objectChange', function (id, obj) {
        // Warning, obj can be null if it was deleted
    });

    // is called if a subscribed state changes
    adapter.on('stateChange', function (id, state) {
        // Warning, state can be null if it was deleted
        adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
        // you can use the ack flag to detect if it is status (true) or command (false)
        if (state && !state.ack) {
            adapter.log.info('ack is not set!');
        }
    });

    // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
    adapter.on('message', function (obj) {
        if (typeof obj == 'object' && obj.message) {
            if (obj.command == 'send') {
                // e.g. send email or pushover or whatever
                console.log('send command');

                // Send response in callback if required
                if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
            }
        }
    });

    // is called when databases are connected and adapter received configuration.
    // start here!
    adapter.on('ready', function () {
        main();
    });
    return adapter;
}


function main() {

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    adapter.log.info('config ipAddress: ' + adapter.config.ipAddress);
    adapter.log.info('config port: ' + adapter.config.port);
    adapter.log.info('config password: ' + adapter.config.password);
    adapter.log.info('config interval: ' + adapter.config.interval);
    adapter.log.info('config forceReInit: ' + adapter.config.forceReInit);

    // in this resol all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    adapter.checkPassword('admin', 'iobroker', function (res) {
        console.log('check user admin pw ioboker: ' + res);
    });

    adapter.checkGroup('admin', 'admin', function (res) {
        console.log('check group user admin group admin: ' + res);
    });


    function initResol() {

        ctx.headerSet = new vbus.HeaderSet();
        var forceReInit = adapter.config.forceReInit;
        ctx.hsc = new vbus.HeaderSetConsolidator({
            interval: adapter.config.interval * 1000,
            timeToLive: (adapter.config.interval * 1000) + 1000,
        });
        var ConnectionClass = vbus['TcpConnection'];
        ctx.connection = new ConnectionClass({
            host: adapter.config.ipAddress,
            password: adapter.config.password
        });

        ctx.connection.on('packet', function (packet) {
            ctx.headerSet.removeAllHeaders();
            ctx.headerSet.addHeader(packet);
            ctx.hsc.addHeader(packet);

            if (forceReInit) {
                ctx.hsc.emit('headerSet', ctx.hsc);
            }
        });

        ctx.hsc.on('headerSet', function (headerSet) {
            var packetFields = spec.getPacketFieldsForHeaders(ctx.headerSet.getSortedHeaders());
            var data = _.map(packetFields, function (pf) {
                return {
                    id: pf.id,
                    name: pf.name,
                    value: pf.rawValue,
                    deviceName: pf.packetSpec.sourceDevice.fullName,
                    deviceId: pf.packetSpec.sourceDevice.deviceId,
                    addressId: pf.packetSpec.sourceDevice.selfAddress,
                    unit: pf.packetFieldSpec.type.unit.unitId,
                    typeId: pf.packetFieldSpec.type.typeId,
                    rootTypeId: pf.packetFieldSpec.type.rootTypeId
                };
            });

            _.each(data, function (item) {
                var deviceId = item.deviceId.replace(/_/g, '');
                var channelId = deviceId + '.' + item.addressId;
                var objectId = channelId + '.' + item.id.replace(/_/g, '');

                if (forceReInit) {
                    initDevice(deviceId, channelId, objectId, item);
                }
                adapter.setState(objectId, item.value, true);
            });

            var lastMessageReceivedId = data.deviceId.replace(/_/g, '') + item.addressId.replace(/_/g, '') + "." + "lastMessageReceived";
            this.adapter.setObjectNotExists(lastMessageReceivedId, new Date().toLocaleString("de-AT"), true);


            if (forceReInit) {
                adapter.extendForeignObject('system.adapter.' + adapter.namespace, {
                    native: {
                        forceReInit: false
                    }
                });
                forceReInit = false;
            }
        });

        ctx.connection.connect();
        ctx.hsc.startTimer();
    }

    function initDevice(deviceId, channelId, objectId, item) {



        adapter.setObjectNotExists(deviceId, {
            type: 'device',
            common: {
                name: item.deviceName
            },
            native: {}
        });
        adapter.setObjectNotExists(channelId, {
            type: 'channel',
            common: {
                name: channelId
            },
            native: {}
        });

        var common = {
            name: item.name,
            type: 'number',
            write: false
        };
        switch (item.unit) {
            case 'DegreesCelsius':
                var name = 'Unknown';
                switch (item.name) {
                    case 'Temperature S1':
                        name = 'Kollektor';
                        break;
                    case 'Temperature S2':
                        name = 'Boiler';
                        break;
                    case 'Temperature S3':
                        name = 'Puffer';
                        break;
                };
                common.name = name;
                common.min = -100;
                common.max = +300;
                common.role = 'value.temperature';
                break;
            case 'Percent':
                common.min = 0;
                common.max = 100;
                common.role = 'value.volume';
                break;
            case 'Hours':
                break;
            case 'WattHours':
                break;
            case 'None':
                break;
            default:
                break;
        }

        adapter.setObjectNotExists(objectId, {
            type: 'state',
            common: common,
            native: {}
        });
    }
    initResol();
}


// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
