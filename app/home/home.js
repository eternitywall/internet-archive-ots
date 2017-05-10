'use strict';

const OpenTimestamps = require('javascript-opentimestamps');

angular.module('myApp.home', ['ngRoute'])

.config(['$routeProvider','$httpProvider', function($routeProvider,$httpProvider) {
  $routeProvider.when('/home', {
    templateUrl: 'home/home.html',
    controller: 'HomeCtrl'
  });
}])
.factory('ArchiveService', function($http) {
      return {
        search: function(string) {
          //https://archive.org/advancedsearch.php?q=opentimestamps&fl%5B%5D=description&fl%5B%5D=identifier&fl%5B%5D=publicdate&fl%5B%5D=title&sort%5B%5D=&sort%5B%5D=&sort%5B%5D=&rows=50&page=1&output=json&callback=callback&save=yes#raw
          var url = "https://archive.org/advancedsearch.php";
          var params = "q="+string+"&rows=50&page=1&output=json&callback=JSON_CALLBACK&save=yes#raw";
          return $http.jsonp(url+"?"+params);
        },
          download: function(identifier) {
              //https://archive.org/download/opentimestamps-calendar-backups/opentimestamps-calendar-backups_files.xml
              // redirect to : 'https://ia801509.us.archive.org/13/items/opentimestamps-calendar-backups/opentimestamps-calendar-backups_files.xml#raw';
              var url = "https://crossorigin.me/";
              url += "https://archive.org/download/"+identifier+"/"+identifier+"_files.xml";
              return $http.get(url);
          },
          downloadFile: function(identifier,name) {
              var url = "https://crossorigin.me/";
              url += "https://archive.org/download/"+identifier+"/"+name;
              return $http.get(url);
          }

      }
})
.factory('OpenTimestampsService', function($http) {
        return {
            timestamp: function(hash) {
                //https://alice.btc.calendar.opentimestamps.org/timestamp/e8fb8fa92c9c116f58c0d35d789939be69472529
                //var url = "http://alice.btc.calendar.opentimestamps.org/timestamp/57cfa5c46716df9bd9e83595bce439c58108d8fcc1678f30d4c6731c3f1fa6c79ed712c66fb1ac8d4e4eb0e7";
                var url = "https://internetarchive.calendar.opentimestamps.org/timestamp/";
                url += hash;
                return $http.get(url,{responseType: "arraybuffer"});
            }

        }
})


.controller('HomeCtrl', function($scope,ArchiveService,OpenTimestampsService) {
        $scope.results = [];
        $scope.input='';

        $scope.search = function(){
            ArchiveService.search($scope.input).then(function(data){
                console.log(data);

                $scope.results=data.data.response.docs;
                $scope.results.forEach(function(item){
                    item.url = "https://archive.org/download/"+item.identifier+"/"+item.identifier+"_files.xml";
                });
            });
        };

        $scope.download = function(identifier){
            ArchiveService.download(identifier).then(function(data){
                console.log(data.data);
                var x2js = new X2JS();
                var json  = x2js.xml_str2json(data.data);
                console.log(json);


                // get scope result item
                var result;
                $scope.results.forEach(function(item){
                    if(item.identifier == identifier){
                        result = item;
                    }
                });

                // add files to result
                if(result !== undefined){
                    result.files = json.files.file;
                }

                result.files.forEach(function(file){
                    file.url="https://archive.org/download/"+identifier+"/"+file._name;
                });

            });
        }

        $scope.getFile = function(identifier,name){
            ArchiveService.downloadFile(identifier,name).then(function(data) {
                console.log(data);
                download(identifier,data.data);
            });
        }

        $scope.getOts = function(identifier,hash,name){
            OpenTimestampsService.timestamp(hash).then(function(data) {
                console.log(data);
                var file = getDocumentFile(identifier,hash);
                file.status = 'Downloading...';

                var timestamp=new Uint8Array(data.data);
                var hexHeader = "004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e8929401";
                var hexOp = "02";
                var hexHash = hash;
                var container = hexToBytes(hexHeader+hexOp+hexHash);

                //console.log(bin2String(data.data));
                //console.log(hexToBytes(container));


                var buffer = new Uint8Array(container.length + timestamp.length);
                buffer.set(container);
                buffer.set(timestamp, container.length);

                var ots=bytesToHex(buffer);
                file.ots=ots;
                console.log(ots);
                download(name+".ots",buffer);


                OpenTimestamps.verify(buffer, hexToBytes(hash), true).then(function(result){
                    if (result === undefined) {
                        file.status='Pending or Bad attestation';
                        console.log('Pending or Bad attestation');
                    } else {
                        file.status='Success! Bitcoin attests data existed as of ' + (new Date(result * 1000));
                        console.log('Success! Bitcoin attests data existed as of ' + (new Date(result * 1000)));
                    }
                    $scope.$apply();
                }).catch(function(err) {
                    console.log(err);
                    file.status=err;
                    $scope.$apply();
                });

            }).catch(function(err){
               console.log(err);
                var file = getDocumentFile(identifier,hash);
                file.status = 'Not found';
            });
        };

        function getDocumentFile(identifier,hash){
            // get scope result item
            var result;
            var file;
            $scope.results.forEach(function(item){
                if(item.identifier == identifier){
                    result = item;
                }
            });
            if(result === undefined)
                return;
            result.files.forEach(function(item){
                if(item.sha1 !== undefined && item.sha1 === hash){
                    file=item;
                }
            });
            if(file === undefined)
                return;
            return file;
        }


        function download(filename,text){
            var element = document.createElement('a');
            element.setAttribute('target', '_blank');
            element.href = window.URL.createObjectURL(new Blob([text], {type: 'octet/stream'}));
            element.download = filename;
            element.click();
        }


        function string2Bin(str) {
            var result = [];
            for (var i = 0; i < str.length; i++) {
                result.push(str.charCodeAt(i));
            }
            return result;
        }
        function bin2String(array) {
            return String.fromCharCode.apply(String, array);
        }

        function ascii2hex(str) {
            var arr = [];
            for (var i = 0, l = str.length; i < l; i ++) {
                var hex = Number(str.charCodeAt(i)).toString(16);
                if (hex<0x10) {
                    arr.push("0" + hex);
                } else {
                    arr.push(hex);
                }
            }
            return arr.join('');
        }

        function hex2ascii(hexx) {
            var hex = hexx.toString();//force conversion
            var str = '';
            for (var i = 0; i < hex.length; i += 2)
                str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
            return str;
        }

        function bytesToHex (bytes) {
            const hex = [];
            for (var i = 0; i < bytes.length; i++) {
                hex.push((bytes[i] >>> 4).toString(16));
                hex.push((bytes[i] & 0xF).toString(16));
            }
            return hex.join('');
        };
        function hexToBytes (hex) {
            const bytes = [];
            for (var c = 0; c < hex.length; c += 2) {
                bytes.push(parseInt(hex.substr(c, 2), 16));
            }
            return bytes;
        };

    });
