#!/bin/zsh
# Read-only telemetry. Never signal another user's process.
date -u '+%Y-%m-%dT%H:%M:%SZ'
uptime
memory_pressure
pmset -g therm
ps -A -o %cpu,comm | sort -nr | head -8
ioreg -r -c AGXAccelerator -l | rg 'PerformanceStatistics' || true
