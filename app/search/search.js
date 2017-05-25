'use strict';


angular.module('myApp.search', ['ngRoute'])

.config(['$routeProvider','$httpProvider', function($routeProvider,$httpProvider) {
  $routeProvider.when('/search/:text', {
    templateUrl: 'search/search.html',
    controller: 'SearchCtrl'
  });
}])

    .factory('ArchiveService', function($http,$sce) {
        return {
            search: function(string,page) {
                //https://archive.org/advancedsearch.php?q=opentimestamps&fl%5B%5D=description&fl%5B%5D=identifier&fl%5B%5D=publicdate&fl%5B%5D=title&sort%5B%5D=&sort%5B%5D=&sort%5B%5D=&rows=50&page=1&output=json&callback=callback&save=yes#raw
                var url = "https://archive.org/advancedsearch.php";
                var params = "q="+string+"&rows=50&page="+page+"&output=json&callback=JSON_CALLBACK&save=yes#raw";
                $sce.trustAsResourceUrl(url+"?"+params);
                return $http.jsonp(url+"?"+params);
            },
            download: function(identifier) {
                //https://archive.org/download/opentimestamps-calendar-backups/opentimestamps-calendar-backups_files.xml
                // redirect to : 'https://ia801509.us.archive.org/13/items/opentimestamps-calendar-backups/opentimestamps-calendar-backups_files.xml#raw';
                var url = "https://api.eternitywall.com/archive-proxy/" + identifier;
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
    .config(function($sceDelegateProvider) {
        $sceDelegateProvider.resourceUrlWhitelist(['**']);
    })
.controller('SearchCtrl', function($scope,$routeParams,$location,$sce,ArchiveService,OpenTimestampsService) {
        $scope.results = [];
        $scope.input=$routeParams.text;
        $scope.showLoader=false;
        $scope.trust = $sce.trustAsHtml;

        // Initialize pagination
        $scope.page=1;
        $scope.item4Page=50;
        $scope.showMore=false;


        $scope.searching = function(text,page){
            $scope.showLoader = true;
            ArchiveService.search(text,page).then(function(data){
                $scope.showLoader=false;

                data.data.response.docs.forEach(function(item){
                    item.url = "https://archive.org/download/"+item.identifier+"/"+item.identifier+"_files.xml";
                    var d = new Date(item.publicdate);
                    var options = { year: 'numeric', month: 'long', day: 'numeric' };
                    item.humanDate = d.toLocaleDateString("en",options);
                    item.loading = false;

                    $scope.results.push(item);
                });

                if(data.data.response.numFound - data.data.response.start < $scope.item4Page){
                    $scope.showMore=false;
                } else {
                    $scope.showMore=true;
                }
            }).catch(function(err){
                $scope.showLoader=false;
                console.error('website archive.org not reachable');
            });
        };

        $scope.search = function(){
            $location.path( '/search/' + $scope.input);
        };

        $scope.loadMore = function(){
            $scope.page++;
            $scope.searching($scope.input, $scope.page);
        };


        // Startup load search
        if ($scope.input != undefined || $scope.input != ""){
            $scope.searching($scope.input, $scope.page);
        }



        $scope.download = function($event, identifier){

            // get scope result item
            var result;
            $scope.results.forEach(function(item){
                if(item.identifier === identifier){
                    result = item;
                }
            });
            if(result === undefined) {
                return;
            }
            result.loading = true;


            ArchiveService.download(identifier).then(function(data){
                //console.log(data.data);
                var x2js = new X2JS();
                var json  = x2js.xml_str2json(data.data);
                //console.log(json);

                // add files to result
                result.loading = false;
                result.files = json.files.file;

                result.files.forEach(function(file){
                    file.url = "https://archive.org/download/"+identifier+"/"+file._name;
                    file.download = true;
                    file.exist = true;
                    file.error = "";
                    file.success = "";

                    if(!file.sha1) {
                        file.download = false;
                        file.exist = false;
                    }

                    file.humanFileSize = file.size>0 ? humanFileSize(file.size) : "";
                });

            });
        };

        $scope.getFile = function(identifier,name){
            ArchiveService.downloadFile(identifier,name).then(function(data) {
                //console.log(data);
                download(identifier,data.data);
            });
        };

        $scope.getOts = function(identifier,hash,name){
            var element;
            OpenTimestampsService.timestamp(hash).then(function(data) {
                //console.log(data);
                var file = getDocumentFile(identifier,hash);
                file.success = "Downloading and verifying...";

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
                //console.log(ots);
                element = download(name+".ots",buffer);
                file.download=false;


                const OpenTimestamps = require('javascript-opentimestamps');
                OpenTimestamps.verify(buffer, hexToBytes(hash), true).then(function(result){
                    if (result === undefined) {
                        file.error='Pending or Bad attestation';
                        console.log('Pending or Bad attestation');
                    } else {
                        var d = new Date(result * 1000);
                        var date_array = d.toUTCString();
                        var utc = date_array.split(" ").splice(0,4).join(" ") + " (UTC)";

                        file.success='Success! Bitcoin proves data existed as of ' + utc  ;
                        console.log('Success! Bitcoin proves data existed as of ' + utc );
                    }
                    $scope.$apply();
                }).catch(function(err) {
                    console.log(err);
                    file.error = 'We are sorry, something failed, try with another browser';
                    $scope.$apply();

                });

            }).catch(function(err){
                console.log(err);
                var file = getDocumentFile(identifier,hash);

                if(err instanceof ReferenceError) {
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                  file.error = 'Sorry, in-browser verification is not supported on your browser. Try with Chromium or client-side validation';
                } else {
                  file.error = 'Sorry, timestamp not yet available for this file';
                }
            });
        };

        function humanFileSize(size) {
            var i = Math.floor( Math.log(size) / Math.log(1024) );
            return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
        };

        function getDocumentFile(identifier,hash){
            // get scope result item
            var result;
            var file;
            $scope.results.forEach(function(item){
                if(item.identifier === identifier){
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
            console.log('Downloading...');
            return element;
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

        function progress( value, tagButton ){
            if(value === true) {
                tagButton.innerHTML = '<div class="smallLoader"></div>IN PROGRESS...';
            } else {
                tagButton.innerHTML = 'SHOW FILES';
            }
        }

    });
