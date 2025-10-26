#!/usr/bin/env bash

set -euo pipefail

PID_FILE="${PID_FILE:-tmp/eval-all.pid}"
LOG_FILE_RECORD="${LOG_FILE_RECORD:-tmp/eval-all-logname}"
INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-300}"
TAIL_LINES="${TAIL_LINES:-40}"

if [[ ! -f "$PID_FILE" ]]; then
  echo "PID file not found: $PID_FILE" >&2
  exit 1
fi

if [[ ! -f "$LOG_FILE_RECORD" ]]; then
  echo "Log metadata file not found: $LOG_FILE_RECORD" >&2
  exit 1
fi

pid="$(tr -d ' \n\r' < "$PID_FILE")"
log_file="$(tr -d ' \n\r' < "$LOG_FILE_RECORD")"

if [[ -z "$pid" ]]; then
  echo "PID file is empty: $PID_FILE" >&2
  exit 1
fi

if ! kill -0 "$pid" 2>/dev/null; then
  echo "Process $pid is not running." >&2
  exit 0
fi

echo "Polling eval run (PID $pid, log $log_file) every $INTERVAL_SECONDS seconds"

while kill -0 "$pid" 2>/dev/null; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] eval still running"
  if [[ -f "$log_file" ]]; then
    tail -n "$TAIL_LINES" "$log_file" | sed 's/^/  /'
  else
    echo "  (log file $log_file not found yet)"
  fi
  sleep "$INTERVAL_SECONDS"
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] eval run completed"
if [[ -f "$log_file" ]]; then
  echo "Final log tail:"
  tail -n "$TAIL_LINES" "$log_file" | sed 's/^/  /'
else
  echo "Log file $log_file missing at completion."
fi
