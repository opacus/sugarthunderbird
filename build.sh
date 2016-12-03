#!/bin/bash
builds="$HOME/builds"
[ -d $builds ] || mkdir $builds
branch=$(git branch | grep '^\*' | cut -d ' ' -f 2)
if [ -z "$1" ]
then
    tagName=$(git tag | tail -1)
    version=$tagName
    echo -n "Building version for $branch and $tagName based on git tag. "
else
    version=$1
    echo -n "Building version for $branch and $1 based on argv: "
fi
read -n1 -rsp $'Press any key to continue or Ctrl+C to exit...\n'
filename=opacusstp-$branch-$version.xpi
if [ -f $builds/$filename ]
then
    rm $builds/$filename
fi
zip -q $builds/opacusstp-$branch-$version.xpi -r . -x build.sh -x '.git/*' -x '.gitignore'
echo "[DONE]";
