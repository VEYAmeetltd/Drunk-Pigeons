import hashlib, hmac, os, sys, time, secrets, json, requests

KEY_ID = os.environ["INTIES_SERVICE_KEY_ID"]
SECRET = os.environ["INTIES_SERVICE_SECRET"]
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001"


def signed_headers(method, path, query=None, body=b""):
    ts = str(int(time.time()))
    nonce = secrets.token_hex(16)
    q = ""
    if query:
        from urllib.parse import urlencode
        q = urlencode(sorted(query.items()))
    target = f"{path}?{q}" if q else path
    body_hash = hashlib.sha256(body or b"").hexdigest()
    canonical = f"{method}\n{target}\n{body_hash}\n{ts}\n{nonce}"
    sig = hmac.new(SECRET.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    return {"X-Service-Key": KEY_ID, "X-Timestamp": ts, "X-Nonce": nonce, "X-Signature": sig}, nonce


def req(method, path, query=None, json_body=None):
    body = json.dumps(json_body).encode() if json_body is not None else b""
    headers, nonce = signed_headers(method, path, query, body)
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    url = BASE + path
    r = requests.request(method, url, headers=headers, params=query, data=body if json_body is not None else None, timeout=15)
    return r, headers, nonce


def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    return cond


ok = True

r, h, nonce = req("GET", "/api/service/advertising/whoami")
ok &= check("whoami 200", r.status_code == 200 and r.json().get("ok") is True)

# replay same nonce -> must fail
r2 = requests.request("GET", BASE + "/api/service/advertising/whoami", headers=h, timeout=15)
ok &= check("replay rejected 401", r2.status_code == 401)

# bad signature
bad = dict(h); bad["X-Signature"] = "0" * 64
r3, _, _ = None, None, None
import time as _t
h2, nonce2 = signed_headers("GET", "/api/service/advertising/whoami")
h2["X-Signature"] = "0" * 64
r3 = requests.get(BASE + "/api/service/advertising/whoami", headers=h2, timeout=15)
ok &= check("bad signature 401", r3.status_code == 401)

# stale timestamp
h3, _ = signed_headers("GET", "/api/service/advertising/whoami")
h3["X-Timestamp"] = str(int(time.time()) - 600)
# must resign with the stale timestamp actually used
ts = h3["X-Timestamp"]
nonce3 = secrets.token_hex(16)
body_hash = hashlib.sha256(b"").hexdigest()
canonical = f"GET\n/api/service/advertising/whoami\n{body_hash}\n{ts}\n{nonce3}"
sig = hmac.new(SECRET.encode(), canonical.encode(), hashlib.sha256).hexdigest()
h3 = {"X-Service-Key": KEY_ID, "X-Timestamp": ts, "X-Nonce": nonce3, "X-Signature": sig}
r4 = requests.get(BASE + "/api/service/advertising/whoami", headers=h3, timeout=15)
ok &= check("stale timestamp 401", r4.status_code == 401)

# missing header
h5, _ = signed_headers("GET", "/api/service/advertising/whoami")
del h5["X-Nonce"]
r5 = requests.get(BASE + "/api/service/advertising/whoami", headers=h5, timeout=15)
ok &= check("missing header 401", r5.status_code == 401)

# no auth at all
r6 = requests.get(BASE + "/api/service/advertising/whoami", timeout=15)
ok &= check("no auth 401", r6.status_code == 401)

# list enquiries
r7, _, _ = req("GET", "/api/service/advertising/enquiries", query={"limit": "5"})
ok &= check("list 200", r7.status_code == 200 and "enquiries" in r7.json())
print(json.dumps(r7.json(), indent=2)[:500])

print("ALL PASS" if ok else "SOME FAILED")
