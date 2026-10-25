#!/bin/sh
set -eu
# Render mounts a fresh persistent disk over this directory; initialize its ownership before dropping privileges.
mkdir -p /var/data
chown -R portfolio:portfolio /var/data
exec gosu portfolio java -jar /app/app.jar
