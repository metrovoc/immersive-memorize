#!/usr/bin/env bash
# Uploads a package to the Chrome Web Store and submits it for review.
# Usage: CWS_ACCESS_TOKEN=... scripts/publish-chrome-web-store.sh immersive-memorize-vX.Y.Z.zip
set -euo pipefail

PUBLISHER_ID=5befd1e6-3d46-465f-88eb-cfe86ea88a60
ITEM_ID=hckblmpcigelkfeinckgflolbdbmdnai
API=https://chromewebstore.googleapis.com
ITEM=publishers/$PUBLISHER_ID/items/$ITEM_ID

zip=${1:?Usage: $0 <package.zip>}
: "${CWS_ACCESS_TOKEN:?Set CWS_ACCESS_TOKEN to an access token with the chromewebstore scope}"

call() {
  curl --fail-with-body -sS -H "Authorization: Bearer $CWS_ACCESS_TOKEN" "$@"
}

response=$(call -X POST -T "$zip" "$API/upload/v2/$ITEM:upload")
echo "Upload: $response"
state=$(jq -r '.uploadState' <<<"$response")
for _ in $(seq 60); do
  [ "$state" = IN_PROGRESS ] || break
  sleep 5
  state=$(call "$API/v2/$ITEM:fetchStatus" | jq -r '.lastAsyncUploadState')
done
if [ "$state" != SUCCEEDED ]; then
  echo "Upload did not succeed: $state" >&2
  exit 1
fi

echo "Publish: $(call -X POST "$API/v2/$ITEM:publish")"
