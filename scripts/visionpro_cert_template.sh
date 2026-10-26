#!/usr/bin/env bash
# Template only. Run in a new empty local directory after setting actual reachable IPs.
set -euo pipefail
: "${TELEOP_HOST_IP:?Set actual Host IPv4}"
: "${TELEOP_PC2_IP:?Set actual PC2 IPv4}"
for task_ip in "$TELEOP_HOST_IP" "$TELEOP_PC2_IP"; do
  [[ "$task_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected IPv4'; exit 2; }
done
for task_file in rootCA.key rootCA.pem key.pem cert.pem server.csr server_ext.cnf; do
  test ! -e "$task_file" || { echo "Refusing overwrite: $task_file"; exit 2; }
done
umask 077
openssl genrsa -out rootCA.key 2048
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 365 -out rootCA.pem -subj '/CN=xr-teleoperate'
openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -out server.csr -subj '/CN=localhost'
cat > server_ext.cnf <<EOF
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
IP.1 = ${TELEOP_HOST_IP}
IP.2 = ${TELEOP_PC2_IP}
EOF
openssl x509 -req -in server.csr -CA rootCA.pem -CAkey rootCA.key -CAcreateserial -out cert.pem -days 365 -sha256 -extfile server_ext.cnf
printf '%s\n' 'Install rootCA.pem on Vision Pro; keep rootCA.key private. Configure actual cert and key paths for both services.'
