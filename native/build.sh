#!/bin/sh
set -e
cd "$(dirname "$0")/.."
mkdir -p bin
swiftc -O native/als-reader.swift -o bin/als-reader
