#!/bin/bash
pkg . -t node18-linux-x64,node18-linux-arm64,node18-macos-x64,node18-macos-arm64
mv ./reproduce-work-linux-x64 ./bin/    # For 64-bit Intel/AMD Linux
mv ./reproduce-work-linux-arm64 ./bin/  # For 64-bit ARM Linux
mv ./reproduce-work-macos-x64 ./bin/    # For Intel-based Macs
mv ./reproduce-work-macos-arm64 ./bin/  # For Apple Silicon Macs
