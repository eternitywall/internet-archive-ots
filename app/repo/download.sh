#!/bin/bash
source=("1" "2" "3" "4" "5")
MIRROR="http://archive.ubuntu.com/ubuntu"
VERSION="zesty"

REPOSITORIES=( "main" "universe" "multiverse" "restricted" )
PLATFORMS=( "binary-i386" "binary-amd64" )

for repo in "${REPOSITORIES[@]}"
do
    for plat in "${PLATFORMS[@]}"
    do
        url=$MIRROR"/dists/"$VERSION"/"$repo"/"$plat"/Packages.gz";
        wget -O Packages.gz $url;
        gunzip Packages.gz
        mv Packages $VERSION.$repo.$plat.Packages.txt
    done
done


#wget http://archive.ubuntu.com/ubuntu/dists/zesty/main/binary-amd64/Packages.gz
#gunzip Packages.gz
#mv Packages main.binary-amd64.Packages.gz

#wget http://archive.ubuntu.com/ubuntu/dists/zesty/main/binary-i386/Packages.gz
#gunzip Packages.gz
#mv Packages main.binary-i386.Packages.gz








#wget http://archive.ubuntu.com/ubuntu/dists/zesty/main/debian-installer/binary-amd64/Packages.gz
#gunzip Packages.gz
#mv Packages main.debian-installer.binary-amd64.Packages.gz
#wget http://archive.ubuntu.com/ubuntu/dists/zesty/main/debian-installer/binary-i386/Packages.gz
#gunzip Packages.gz
#mv Packages main.debian-installer.binary-i386.Packages.gz
#wget http://archive.ubuntu.com/ubuntu/dists/zesty/main/source/Packages.gz
#gunzip Packages.gz
#mv Packages main.binary-i386.Packages.gz
