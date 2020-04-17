var vbus = require('resol-vbus');
var _ = require('lodash');

var adapter = { config: { interval: 60, ipAddress: "10.0.0.150", password: "vbus",forceReInit:false }, log: { info: console.log } };
var spec = vbus.Specification.getDefaultSpecification();

var ctx = {
    headerSet: null,
    hsc: null,
    connection: null,
};

const main =  () => {

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

    ctx.connection.on('packet', (packet) => {
        ctx.headerSet.removeAllHeaders();
        ctx.headerSet.addHeader(packet);
        ctx.hsc.addHeader(packet);

        if (forceReInit) {
            ctx.hsc.emit('headerSet', ctx.hsc);
        }
    });

    ctx.hsc.on('headerSet', (headerSet) => {
        var packetFields = spec.getPacketFieldsForHeaders(ctx.headerSet.getSortedHeaders());

        adapter.log.info('headerSet packetFields received: ' + JSON.stringify(packetFields));

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

            adapter.log.info(objectId + ": " + item.value);


        });

    });

    ctx.connection.connect();
    ctx.hsc.startTimer();

    return new Promise((resolve, reject) => {
        // nop, just run forever
    });
}


 main();