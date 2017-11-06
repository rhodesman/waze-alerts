var cp = require('child_process');
var fs = require('fs');
var net = require('net'),
    JsonSocket = require('json-socket');

mainProg();

function mainProg() {
    cp.exec('gpspipe -w -n 10 | grep -m 1 lat > gps-loc.json', (error, stdout, stderr) => {
          var gpsData = JSON.parse(fs.readFileSync('gps-loc.json', 'utf8'));
          if((gpsData["lat"] != null) && (gpsData["lon"] != null)) {
            var curLoc = {
                latitude: gpsData["lat"],
                longitude: gpsData["lon"],
                track: gpsData["track"]
            };
            sendLocation(curLoc);
          }else {
            setTimeout(mainProg, 60000);
          }
    });
}

function sendLocation(myloc) {
    var port = 9839; //The same port that the server is listening on
    var host = '10.0.10.202';
    var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
    socket.connect(port, host);
    socket.on('connect', function() { //Don't send until we're connected
        console.log("connection to server established on " + port);
        socket.sendMessage({command: 'start', location: myloc}, function() {
          console.log("*******connection is closed******");
        });
        socket.on('message', function(dataReturned) {
            //dataReturned = JSON.parse(dataReturned);
            //console.log(dataReturned.jams[0]);
            console.log("*******Message Recieved******");
            if(dataReturned.alerts[0] != null) {
                printLCD(dataReturned.alerts.dist,dataReturned.alerts.type);
                //console.log("Alert: "+dataReturned.alerts.type+" Distance: "+dataReturned.alerts.dist);
                //setTimeout(mainProg(), 5000);
            }else {
                console.log("no alerts!");
                setTimeout(mainProg(), 60000);
            }
            if(dataReturned.jams[0] != null) {
                //console.log("current jams: " + JSON.stringify(dataReturned.jams[0]) );
                for (var i = 0; i < dataReturned.jams.length; i++) {
                    //console.log(dataReturned.jams[i]);
                }
            }
            //socket.sendMessage({command: 'stop'});
            //setTimeout(mainProg(), 60000);

        });
    });
}

//Process Data for Raspberry Pi LCD
function printLCD(lcdMessage,lcdType) {
    lcdType = '!!' + lcdType + '!!';
    lcdMessage = 'Dist: ' + lcdMessage + 'mi';
    console.log('lcdMsge:'+ lcdMessage + ' type:' + lcdType);
    setTimeout(mainProg(), 5000);
}
