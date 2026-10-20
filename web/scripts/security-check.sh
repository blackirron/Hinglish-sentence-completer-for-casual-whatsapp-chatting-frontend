#!/usr/bin/env bash
# Black box checks. Run after any deploy. The API address is optional (server mode only).
#   web/scripts/security-check.sh https://your-site.vercel.app [https://your-api.example]
set -u
SITE="${1:-http://localhost:3000}"
API="${2:-}"
fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "ok    $1 ($3)"; else echo "FAIL  $1 expected $2 got $3"; fail=1; fi
}
J='content-type: application/json'
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

check "cross site post is refused"   403 "$(code -X POST "$SITE/api/predict" -H "$J" -H 'Origin: https://evil.example' -H 'Sec-Fetch-Site: cross-site' -d '{"mode":"next-word","prompt":"hi"}')"
check "wrong content type"           415 "$(code -X POST "$SITE/api/predict" -H 'content-type: text/plain' -d x)"
check "unknown field rejected"       422 "$(code -X POST "$SITE/api/predict" -H "$J" -d '{"mode":"next-word","prompt":"hi","evil":1}')"
check "k out of range rejected"      422 "$(code -X POST "$SITE/api/predict" -H "$J" -d '{"mode":"next-word","prompt":"hi","k":999}')"
check "empty after cleaning"         422 "$(code -X POST "$SITE/api/predict" -H "$J" -d '{"mode":"next-word","prompt":"\u0000‮  "}')"
check "prompt over the limit"        422 "$(python3 -c "print('{\"mode\":\"next-word\",\"prompt\":\"'+'a'*400+'\"}')" | curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/predict" -H "$J" --data-binary @-)"
check "oversized body"               413 "$(python3 -c "print('{\"mode\":\"next-word\",\"prompt\":\"'+'a'*5000+'\"}')" | curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/predict" -H "$J" --data-binary @-)"
check "GET on the proxy"             405 "$(code "$SITE/api/predict")"
if [ -n "$API" ]; then
check "API refuses no key"           401 "$(code -X POST "$API/v1/next" -H "$J" -d '{"prompt":"hi"}')"
check "API refuses wrong key"        401 "$(code -X POST "$API/v1/next" -H "$J" -H 'x-api-key: wrong' -d '{"prompt":"hi"}')"
check "API docs hidden in production" 404 "$(code "$API/docs")"
fi
for h in content-security-policy x-content-type-options x-frame-options strict-transport-security referrer-policy cross-origin-opener-policy cross-origin-embedder-policy; do
  if curl -sI "$SITE/" | grep -qi "^$h:"; then echo "ok    header $h"; else echo "FAIL  header $h missing"; fail=1; fi
done
exit $fail
