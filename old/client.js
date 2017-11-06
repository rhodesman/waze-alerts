//var cp = require('child_process');
//var fs = require('fs');
var gpsd = require('node-gpsd');
var net = require('net'),
    JsonSocket = require('json-socket');
/*var Lcd = require('lcd'),
    lcd = new Lcd({
        rs: 20,
        e: 21,
        data: [5, 6, 13, 19],
        cols: 16,
        rows: 2
    });*/
var SerialPort = require('serialport');
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
//var stream = fs.createWriteStream("alert.log");

//Start up the Pi LCD and initiate Program start
scrollMess('** Police Alert Started ** ', function() {
  startGps('start');
});

function startGps(stopGPS) {
  if(stopGPS == 'stop') {
    daemon.stop(function() {
      console.log('GPS Stopped');
    });
  }else if(stopGPS == 'start') {
    daemon.start(function() {
      console.log('GPS Started');
      callGps(function(tpv) {
        mainProg(tpv);
      });
    });
  }
}

function callGps(callback) {
  listener.connect(function() {
    listener.watch({ class: 'WATCH', json: true, nmea: false });
    console.log('connected');
    listener.on('TPV', function (tpv) {
        console.log('tpv:'+tpv);
        callback(tpv);

    });
  });
}
//Check if GPS data is valid.  If valid send to server for processing, otherwise display no signal.
function mainProg(tpvData) {
  var gpsData = tpvData;
  console.log(gpsData);
  if((gpsData.lat != null) && (gpsData.lon != null)) {
    var curLoc = {
        latitude: gpsData.lat,
        longitude: gpsData.lon,
        track: gpsData.track
    };
    console.log(curLoc);
    scrollMess(' ', function() {
      sendLocation(curLoc);
    });
  }else {
    scrollMess('** No Signal **');
  }

}
//Send location data to Server and process recieved messages
function sendLocation(myloc) {
    var port = 9839;
    var host = 'tmc.wblabs.co';
    var socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);
    socket.on('connect', function() { //Don't send until we're connected
        //scrollMess("connection to server established on " + port);
        console.log("connection to server established on " + port);
        socket.sendMessage({command: 'start', location: myloc}, function() {
          console.log("*******message sent******");
        });
        socket.on('message', function(dataReturned) {
            console.log("*******recieved message******");
            //console.log(dataReturned);
            if(dataReturned.alerts[0] != null) {
                printLCD(dataReturned.alerts.dist,dataReturned.alerts.type);
            }else {
                //scrollMess("no alerts!");
                setTimeout(function() {
                  startGps('start');
                }, 60000);
            }
        });
    });
}
//Process Data for Raspberry Pi LCD
function printLCD(lcdMessage,lcdType) {
    lcdType = lcdType + '!!';
    lcdMessage = 'Dist: ' + lcdMessage + 'mi';
    //console.log('lcdMsge:'+ lcdMessage + ' type:' + lcdType);
    clearScreen(function() {
      sPort.write(lcdType+'\n'+lcdMessage);
      sPort.drain(function() {
        startGps('start');
      });
    });
}
//Display Messages to LCD and Console
function scrollMess(aMessage,callback) {
  /*clearScreen(function() {
    if(aMessage.length > 16) {
      function chunk(str, n, calBack) {
        var ret = [];
        var i;
        var len;
        for(i = 0, len = str.length; i < len; i += n) {
           ret.push(str.substr(i, n))
        }
        return ret
        calBack;
      };
      chunk(aMessage,16,function() {
        sPort.write(aMessage);
        sPort.drain(function() {
          if(callback && typeof callback == "function") {
            callback();
          }
        });
      }).join('\n');
    }else {*/
      sPort.write(aMessage);
      sPort.drain(function() {
        if(callback && typeof callback == "function") {
          callback();
        }
      });
    //}
  //});
}
function clearScreen(callback) {
  var clearMsg = "                /n                ";
  sPort.write(clearMsg);
  sPort.drain(callback);
}
