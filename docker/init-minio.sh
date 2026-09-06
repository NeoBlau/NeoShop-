#!/bin/sh
# Bucket bootstrap for local development.
# Public prefix: optimized GLB, previews, photos. Everything else stays private
# and is only reachable through short-lived presigned URLs issued by the API.
set -eu

mc alias set local http://minio:9000 sfera sfera-secret

mc mb --ignore-existing local/sfera-assets

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

mc anonymous set-json /tmp/public-prefix-policy.json local/sfera-assets

echo "minio: bucket sfera-assets ready (public/ prefix is world-readable)"
