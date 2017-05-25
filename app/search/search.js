'use strict';


angular.module('myApp.search', ['ngRoute'])

.config(['$routeProvider','$httpProvider', function($routeProvider,$httpProvider) {
  $routeProvider.when('/search/:text', {
    templateUrl: 'search/search.html',
    controller: 'SearchCtrl'
  });
}])
.controller('SearchCtrl', function($scope,$routeParams,ArchiveService,OpenTimestampsService,toastr) {
        $scope.results = [];
        $scope.input=$routeParams.text;
        $scope.showLoader=false;

        // Initialize pagination
        $scope.page=1;
        $scope.item4Page=50;
        $scope.showMore=false;


        $scope.searching = function(text,page){
            ArchiveService.search(text,page).then(function(data){
                $scope.showLoader=false;

                data.data.response.docs.forEach(function(item){
                    item.url = "https://archive.org/download/"+item.identifier+"/"+item.identifier+"_files.xml";

                    var d = new Date(item.publicdate);
                    var options = { year: 'numeric', month: 'long', day: 'numeric' };
                    item.humanDate = d.toLocaleDateString("en",options);

                    $scope.results.push(item);
                });

                if($scope.results.length === 0){
                    $scope.results.push({title:'No information found'});
                }

                if(data.data.response.numFound - data.data.response.start < $scope.item4Page){
                    $scope.showMore=false;
                } else {
                    $scope.showMore=true;
                }
            }).catch(function(err){
                $scope.showLoader=false;
                toastr.error('website archive.org not reachable');
            });
        };

        $scope.search = function(){
            if($scope.input === ""){
                return;
            }
            $scope.showLoader = true;
            $scope.results = [];
            $scope.page=1;

            $scope.searching($scope.input, $scope.page);
        };

        $scope.loadMore = function(){
            $scope.page++;
            $scope.searching($scope.input, $scope.page);
        };


        // Startup load search
        if ($scope.input != undefined || $scope.input != ""){
            $scope.search();
        }



        $scope.download = function($event, identifier){
            var tag = $event.currentTarget;
            progress(true, tag);
            ArchiveService.download(identifier).then(function(data){
                //console.log(data.data);
                var x2js = new X2JS();
                var json  = x2js.xml_str2json(data.data);
                //console.log(json);

                progress(false, tag);

                // get scope result item
                var result;
                $scope.results.forEach(function(item){
                    if(item.identifier === identifier){
                        result = item;
                    }
                });

                // add files to result
                if(result !== undefined){
                    result.files = json.files.file;
                }

                result.files.forEach(function(file){
                    file.url = "https://archive.org/download/"+identifier+"/"+file._name;
                    file.download = true;
                    file.exist = true;

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
            OpenTimestampsService.timestamp(hash).then(function(data) {
                //console.log(data);
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
                //console.log(ots);
                download(name+".ots",buffer);
                file.download=false;


                const OpenTimestamps = require('javascript-opentimestamps');
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
                    toastr.error('Verification failed');
                });

            }).catch(function(err){
               console.log(err);
                var file = getDocumentFile(identifier,hash);
                file.status = 'Not found';
                toastr.error('File not found');
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
            toastr.success('Downloading...');
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
