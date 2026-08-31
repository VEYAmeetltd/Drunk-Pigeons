"""Leaderboard nickname moderation (server-side source of truth).

Layers:
  1) Unicode safety   — strip/deny zero-width, bidi-control and other format chars.
  2) Normalisation     — NFKC, confusable(homoglyph) fold, case fold, leetspeak fold,
                         separator removal, repeat collapse, reversal (high-risk only).
  3) Rule engine       — tiered checks: exact/evasion slurs (categorised dataset),
                         high-risk phonetic families, religious-respect rules,
                         threats / terror praise / staff impersonation, and the
                         legacy ordinary-profanity policy (boundary-aware, low FP).
  4) Allowlist         — legitimate names / ordinary words that coincidentally
                         contain banned sub-sequences are never rejected on substring.

Only the checks below run server-side; the raw dataset never leaves the backend.
Callers get a single boolean; a rejected name maps to a generic error code.

Dataset provenance:
  Curated in-house rule set (no third-party word list bundled). Categories and
  known-evasion forms compiled from public anti-hate references and reviewed by
  hand. Versioned via DATASET_VERSION so entries can be audited/extended.
"""
import re
import unicodedata

DATASET_VERSION = "dp-mod-2026-06-01"

# --- 1) Unicode safety -------------------------------------------------------
# zero-width, BOM, word-joiner, bidi embedding/override/isolates
_INVISIBLE_RE = re.compile(
    "[\u200b\u200c\u200d\u200e\u200f\u2060\ufeff"
    "\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069]"
)


def has_invisible(s: str) -> bool:
    if _INVISIBLE_RE.search(s):
        return True
    # any other Cc (control) or Cf (format) char
    return any(unicodedata.category(ch) in ("Cc", "Cf") for ch in s)


# --- 2) Normalisation --------------------------------------------------------
# Common confusables (homoglyphs) -> Latin. Reliable, conservative subset.
_CONFUSABLE = {
    "а": "a", "ӓ": "a", "е": "e", "ё": "e", "о": "o", "р": "p", "с": "c",
    "у": "y", "х": "x", "ѕ": "s", "і": "i", "ї": "i", "ј": "j", "к": "k",
    "м": "m", "н": "h", "т": "t", "в": "b", "г": "r", "п": "n", "ѵ": "v",
    # Greek
    "α": "a", "ο": "o", "ε": "e", "ρ": "p", "τ": "t", "ι": "i", "κ": "k",
    "ν": "v", "χ": "x", "υ": "y", "β": "b", "ѡ": "w",
    # fullwidth / misc already handled by NFKC mostly
}

# Leetspeak: two views because some glyphs are ambiguous (1 -> i or l).
_LEET_I = str.maketrans({"0": "o", "1": "i", "!": "i", "|": "i", "3": "e",
                         "4": "a", "@": "a", "5": "s", "$": "s", "7": "t",
                         "8": "b", "9": "g", "6": "g", "(": "c", "€": "e",
                         "+": "t", "2": "z"})
_LEET_L = str.maketrans({"0": "o", "1": "l", "!": "i", "|": "l", "3": "e",
                         "4": "a", "@": "a", "5": "s", "$": "s", "7": "t",
                         "8": "b", "9": "g", "6": "g", "(": "c", "€": "e",
                         "+": "t", "2": "z"})


def _base(s: str) -> str:
    s = _INVISIBLE_RE.sub("", s)
    s = unicodedata.normalize("NFKC", s)
    # strip combining marks (accents) -> base letters
    s = "".join(c for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = "".join(_CONFUSABLE.get(c, c) for c in s)
    return s


def _collapse(s: str) -> str:
    return re.sub(r"(.)\1{2,}", r"\1", s)  # 3+ repeats -> 1


def comparison_forms(name: str):
    """All moderation comparison strings (never stored)."""
    base = _base(name)
    forms = set()
    for leet in (_LEET_I, _LEET_L):
        t = base.translate(leet)
        letters = re.sub(r"[^a-z]", "", t)          # separators/digits removed
        forms.add(letters)
        forms.add(_collapse(letters))
        forms.add(_collapse(letters)[::-1])         # reversed (high-confidence only)
    # keep a digit-preserving alnum form too (for standalone checks)
    forms.add(re.sub(r"[^a-z0-9]", "", base))
    forms.discard("")
    return base, forms


# --- 3) Dataset --------------------------------------------------------------
# High-risk phonetic FAMILIES: tolerant regexes (letters already leet-folded).
# Boundary-anchored to avoid embedding false positives.
_B = r"(?<![a-z]){}(?![a-z])"
HIGH_RISK = [
    # n-word: double-g core is unambiguous -> allow as substring (catches sandnigga);
    r"n+i+g{2,}(a+|e+r+|a+h+|u+h+|a+z+|r+|r+a+)?",
    # 'nigsa' style (n1g5a): single g but the s makes it distinctive
    r"(?<![a-z])n+i+g+s+a+(?![a-z])",
    # single-g phonetic spellings ending in an 'a'/'uh' sound (niga, neega, nigah,
    # niguh, n33ga). Boundary-anchored on BOTH sides so country/name words are safe:
    # 'Niger'/'Nigeria'/'Nigel' end in 'e', and 'Nigatu' has a trailing letter.
    _B.format(r"n+[ie]+g+(a+h?|u+h+)"),
    _B.format(r"f+a+g+(o+t+|g+o+t+|s+)?"),                    # f-slur family
    _B.format(r"k+i+k+e+s?"),                                 # antisemitic
    _B.format(r"c+h+i+n+k+s?"),                               # anti-Asian
    _B.format(r"g+o+o+k+s?"),
    _B.format(r"s+p+i+c+s?"),                                 # anti-Latino
    _B.format(r"w+e+t+b+a+c+k+s?"),
    _B.format(r"t+r+a+n+n+(y+|i+e+)"),
    _B.format(r"c+o+o+n+s?"),
    _B.format(r"r+a+g+h+e+a+d+s?"),                           # anti-Arab/Muslim
    _B.format(r"t+o+w+e+l+h+e+a+d+s?"),
    _B.format(r"g+y+p+s+(y+|i+e+)"),                          # anti-Roma (slur form)
    _B.format(r"p+a+k+i+s?"),                                 # anti-South-Asian
    r"c+u+r+r+y+m+u+n+c+h+e+r+",
    _B.format(r"r+e+d+s+k+i+n+s?"),                            # anti-Indigenous slur
    r"s+a+n+d+n+i+g+",
]
HIGH_RISK_RE = [re.compile(p) for p in HIGH_RISK]

# Coded hate slogans / groups (compact, distinctive).
HATE_CODED = [
    r"\bheilhitler\b", r"\bsieghail\b", r"\bwhitepower\b", r"\bwhitepride\b",
    r"\b1488\b", r"\b14words\b", r"gasthe\w*", r"killall\w+", r"genocide\w*",
    r"\bkkk\b", r"nazi", r"hitler", r"holohoax",
]
HATE_CODED_RE = [re.compile(p) for p in HATE_CODED]

# Terror praise / credible threats (require a target/verb, not a bare noun).
THREAT_RE = [
    re.compile(r"\b(join|ilove|proud|praise|support|long)?(isis|alqaeda|alqueda|taliban|daesh)\b.*\b(rules|forever|proud|love)?"),
    re.compile(r"\b(kill|behead|shoot|bomb|murder|rape)(all|the|every|u|you)\w*"),
    re.compile(r"\bschoolshoot\w*"),
]
# 'isis' alone is also a legitimate name -> only reject with praise/threat context.
TERROR_TOKENS = ("isis", "alqaeda", "alqueda", "taliban", "daesh")
TERROR_CONTEXT = ("kill", "behead", "bomb", "jihad", "join", "praise", "love",
                  "proud", "attack", "rules", "forever")

# Staff / official impersonation.
IMPERSONATE_EXACT = {"admin", "administrator", "moderator", "mod", "staff",
                     "owner", "official", "support", "developer", "system",
                     "root", "sysadmin"}
IMPERSONATE_RE = [
    re.compile(r"drunkpigeon\w*(admin|staff|official|mod|team|support|owner)"),
    re.compile(r"(official|real|the)drunkpigeon\w*"),
]

# Ordinary-profanity policy (legacy) — boundary-aware to avoid Scunthorpe FPs.
# short/ambiguous -> boundary anchored; distinctive -> substring ok.
PROFANITY_BOUNDARY = ["sex", "paki", "rape", "slut", "porn", "dick", "kkk", "twat"]
PROFANITY_SUBSTR = ["fuck", "shit", "cunt", "faggot", "whore", "bitch",
                    "retard", "penis", "pussy", "cumshot", "blowjob", "wank"]

# Religious respect.
# Standalone reserved words that are rejected on their own (per policy): Jesus / God.
RELIGIOUS_RESERVED = {"jesus", "god"}
# Prophet-name transliteration variants: rejected ONLY when the whole name is one
# of them (standalone). Matched on a fully de-duplicated ("squeezed") letter form
# so leet/repeats/homoglyph/separator variants collapse to the same shape.
# Squeezed targets: muhamad, mohamed, mohamad, muhamed  ->  ^m[ou]h[ao]m[ae]d$
MUHAMMAD_STANDALONE_RE = re.compile(r"^m[ou]h[ao]m[ae]d$")
# Broader set used only for the "reserved word + insult" combination check
# (these are legitimate personal names on their own, so never standalone-rejected).
RELIGIOUS_NAMES = {"jesus", "god", "allah", "christ", "prophet",
                   "muhammad", "muhammed", "mohammed", "mohamed", "mohammad",
                   "muhamad", "mohamad", "muhamed"}
RELIGIOUS_INSULT = ("shit", "sucks", "sux", "fuck", "fuk", "hate", "dead",
                    "fake", "gay", "isnt", "isnot", "notking", "notreal",
                    "stupid", "dumb", "loser", "crap", "damn", "kill", "die",
                    "rot", "bitch", "sucker", "liar", "false", "phony", "cum",
                    "porn", "rape", "whore", "penis", "boner")
# affirming forms are explicitly fine even though they contain a reserved word
RELIGIOUS_AFFIRM = ("isking", "isgod", "islord", "issavior", "issaviour",
                    "loves", "saves", "isreal", "islove", "isrisen", "reigns",
                    "isalive", "isgood", "bless", "praise", "isholy")

# Allowlist: legit compacts that must never be blocked on a coincidental match.
ALLOWLIST = {
    "analyst", "analysis", "analog", "scunthorpe", "cockburn", "cockburns",
    "shiitake", "class", "classic", "classy", "pass", "passion", "compass",
    "assassin", "assassins", "grape", "grapes", "therapist", "cumberland",
    "cumbria", "dickens", "dickinson", "penistone", "lightwater", "clint",
    "flick", "matsushita", "essex", "sussex", "middlesex", "wednesbury",
    "kingsman", "kingston", "mango", "manga", "dragon", "signal", "signature",
    "morning", "singing", "kingfisher", "spice", "spicy", "specter", "special",
    "gordon", "godfrey", "godwin", "godiva", "godzilla", "godfather", "goddard",
    "isis", "isadora", "isabel", "isabella", "gypsophila",
}


def _standalone(letters: str, word: str) -> bool:
    return letters == word or letters == word + "s"


# --- 3) Engine ---------------------------------------------------------------
def moderation_reason(name: str):
    """Return None if allowed, else a short internal reason (never sent to client)."""
    if not isinstance(name, str) or not name:
        return "empty"
    if has_invisible(name):
        return "invisible"

    base, forms = comparison_forms(name)
    letter_forms = {f for f in forms if f and f.isalpha()}
    any_form = forms

    # explicit allowlist (exact) short-circuits substring style checks
    if any(f in ALLOWLIST for f in letter_forms):
        allow = True
    else:
        allow = False

    # Religious rules (checked before allowlist bypass so 'god'/'jesus' standalone
    # can never be allowlisted around).
    for lf in letter_forms:
        for word in RELIGIOUS_RESERVED:
            if _standalone(lf, word):
                return "religious-standalone"
        # standalone prophet-name variants (squeeze all repeats first)
        if MUHAMMAD_STANDALONE_RE.match(re.sub(r"(.)\1+", r"\1", lf)):
            return "religious-standalone"
        for word in RELIGIOUS_NAMES:
            if word in lf:
                if any(a in lf for a in RELIGIOUS_AFFIRM):
                    continue
                if any(ins in lf for ins in RELIGIOUS_INSULT):
                    return "religious-insult"

    if allow:
        return None

    # High-risk phonetic families (most important; boundary-anchored).
    for lf in letter_forms:
        for rx in HIGH_RISK_RE:
            if rx.search(lf):
                return "slur-highrisk"

    # Coded hate / groups.
    for f in any_form:
        for rx in HATE_CODED_RE:
            if rx.search(f):
                return "hate-coded"

    # Terror praise / threats (context-guarded).
    for lf in letter_forms:
        if any(t in lf for t in TERROR_TOKENS) and any(c in lf for c in TERROR_CONTEXT):
            return "terror"
        for rx in THREAT_RE:
            if rx.search(lf):
                return "threat"

    # Staff impersonation.
    for lf in letter_forms:
        if lf in IMPERSONATE_EXACT:
            return "impersonation"
        for rx in IMPERSONATE_RE:
            if rx.search(lf):
                return "impersonation"

    # Ordinary-profanity policy (legacy, boundary-aware).
    for lf in letter_forms:
        for w in PROFANITY_SUBSTR:
            if w in lf:
                return "profanity"
        for w in PROFANITY_BOUNDARY:
            if re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", lf):
                return "profanity"

    return None


def is_allowed(name: str) -> bool:
    return moderation_reason(name) is None
