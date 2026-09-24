#!/bin/sh
# Bucket bootstrap for local development.
# Public prefix: optimized GLB, previews, photos. Everything else stays private
# and is only reachable through short-lived presigned URLs issued by the API.
#
# Runs inside the MinIO image itself, which bundles mc. Two consequences: the
# config directory has to be somewhere uid 1001 can write, and /tmp is the only
# such place, since $HOME is /.
set -eu

MC="mc --config-dir /tmp/mc"

$MC alias set local http://minio:9000 sfera sfera-secret

$MC mb --ignore-existing local/sfera-assets

cat > /tmp/public-prefix-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::sfera-assets/public/*"]
    }
  ]
}
JSON

$MC anonymous set-json /tmp/public-prefix-policy.json local/sfera-assets

echo "minio: bucket sfera-assets ready (public/ prefix is world-readable)"
