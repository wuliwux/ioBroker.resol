var fs = require("fs");
var _ = require('lodash');

 console.log("\n *STARTING* \n");
// Get content from file
 var contents = fs.readFileSync("D:\\Projects\\_Privat\\github\\ioBroker.resol\\test\\samplefilereader\\sample2.json");
// Define to JSON type
 var jsonContent = JSON.parse(contents);
// Get Value from JSON
 
var data = _.map(jsonContent, function (pf) {
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

log("\n *EXIT* \n");