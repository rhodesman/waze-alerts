/*
  NODE Dependencies
*/
var fs = require('fs');
var util = require('util');
var gpsd = require('node-gpsd');
var net = require('net'),
    JsonSocket = require('json-socket');
var SerialPort = require('serialport');

/*
  Setup App Logging
*/
var log_file = fs.createWriteStream(__dirname + '/logs/node.debug.log', {flags : 'w'});
var log_stdout = process.stdout;

function logtoFile(d) { //
  //log_file.write(util.format(d) + '\n');
  //log_stdout.write(util.format(d) + '\n');
  //console.log('/////////////////////////////////');
  console.log(d);
  //delete d;
};

/*
  Initialize Device Connections
*/
var sPort = new SerialPort('/dev/ttyACM0', {
  baudRate: 9600
});

var daemon = new gpsd.Daemon({
  device: '/dev/gps0',
  verbose: true
});
var listener = new gpsd.Listener({
  parse: true
});
var clearLCD = '                ';
clearLCD = clearLCD + clearLCD;
var loopCheck = 0;
/*
  Initiate Program Start
*/
scrollMess('*Alert Started*', function() {
  startGps('start');
});

/*
  Starts GPS listener if 'start' is passed to function
  Stops GPS listener if 'stop' is passed to function
*/
function startGps(stopGPS, callback) {
  console.log(loopCheck);
  if(stopGPS == 'stop') {
    listener.disconnect(function() {
      logtoFile('Listener Stopped');
    });
    daemon.stop(function() {
      logtoFile('GPS Stopped');
    });
  }else if(stopGPS == 'start') {
    daemon.start(function() {
      logtoFile('GPS Started');
      getPosition();
    });
  }
  if(callback && typeof callback == "function") {
    callback();
  }
}
function getPosition(callback) {
  console.log("listener is connected: " + listener.isConnected());
  if(listener.isConnected() == false) {
    listener.connect(function() {
      listener.watch();
    });
    callGps(function(tpv) {
      mainProg(tpv);
    });
  }else {
    callGps(function(tpv) {
      mainProg(tpv);
    });
  }
  if(callback && typeof callback == "function") {
    callback();
  }
}

function callGps(callback) {
  listener.on('TPV', function (tpv) {
    if(tpv.mode == "1") {
      scrollMess('** No Signal **', function() {
        startGps('stop', function() {
          startGps('start');
        });
      });
    }else {
      logtoFile('tpv:'+JSON.stringify(tpv));
      callback(tpv);
    }
  });
  listener.on('error', function(error) {
    logtoFile(error);
    startGps('stop', function() {
      startGps('start');
    });
  });
}
//Check if GPS data is valid.  If valid send to server for processing, otherwise display no signal.
function mainProg(tpvData) {
  if(typeof gpsData !== 'undefined') {
    delete gpsData;
    gpsData = tpvData;
  }else {
    gpsData = tpvData;
  }
  logtoFile(gpsData);
  if((gpsData.lat != null) && (gpsData.lon != null)) {
    curLoc = {
        latitude: gpsData.lat,
        longitude: gpsData.lon,
        track: gpsData.track
    };
    logtoFile(curLoc);
    scrollMess(clearLCD, function() {
      sendLocation(curLoc);
      //delete curLoc;
    });
  }else {
    scrollMess('** No Signal **');
  }
}
//Send location data to Server and process recieved messages
function sendLocation(myloc) {
    var port = 9838;
    var host = 'tmc.wblabs.co';
    var socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);
    socket.on('connect', function() { //Don't send until we're connected
        //scrollMess("connection to server established on " + port);
        logtoFile("connection to server established on " + port);
        socket.sendMessage({command: 'start', location: myloc}, function() {
          logtoFile("*******message sent******");
        });
        socket.on('message', function(dataReturned) {
            logtoFile("*******recieved message******");
            logtoFile(dataReturned);
            socket.sendEndMessage({command: 'stop'},function() {
              logtoFile("*****connection closed*****");
            });
            if(dataReturned.alerts[0] != null) {
              printLCD(dataReturned.alerts.dist,dataReturned.alerts.type);
            }else {
                scrollMess("no alerts!");
                setTimeout(function() {
                  delete dataReturned;
                  getPosition();
                }, 10000);
            }
        });
    });
}
//Process Data for LCD Display
function printLCD(lcdMessage,lcdType) {
    lcdType = lcdType + '!!';
    lcdMessage = 'Dist: ' + lcdMessage + 'mi';
    if(lcdType.length <= 16 ){
      exSpace = 16 - lcdType.length;
      for (i=0; i < exSpace; i++) {
         lcdType = lcdType + ' ';
      }
      delete exSpace;
    }
    scrollMess(lcdType+lcdMessage, function() {
      setTimeout(function() {
        getPosition();
      }, 25000);
    });
}
//Display Messages to LCD and Console
function scrollMess(aMessage,callback) {
  console.log(aMessage);
  sPort.write(clearLCD);
  sPort.write(aMessage);
  sPort.on('error', function(err) {
    logtoFile('Error: ' + err.message);
  });
  sPort.drain(function() {
    if(callback && typeof callback == "function") {
      callback();
    }
  });
}
