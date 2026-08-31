"""Moderation test suite: high-confidence abuse must reject; clean names must pass.
Run: cd /app/backend && python -m pytest tests/test_moderation.py -q
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from moderation import is_allowed, moderation_reason  # noqa: E402

# --- Names that MUST be rejected (abuse / evasions) ---
ABUSE = [
    # n-word family: exact, leet, separators, repeats, homoglyph, phonetic, mixed
    "nigger", "nigga", "n1gga", "n1g5a", "n.i.g.g.a", "n i g g a", "niiiigga",
    "n1gg4", " niggr", "niggaz", "sandnigger", "sandn1gga",
    # other categorised slurs + leet/sep
    "faggot", "f4gg0t", "f a g g o t", "kike", "k1ke", "chink", "ch1nk",
    "gook", "spic", "sp1c", "wetback", "tranny", "coon", "raghead",
    "towelhead", "paki", "p4k1", "currymuncher", "redsk1n",
    # coded hate / groups
    "heilhitler", "sieghail", "whitepower", "1488", "kkk", "nazi", "adolfhitler",
    "gasthejews",
    # religious standalone + insults + evasions
    "Jesus", "God", "god", "j3sus", "G0d", "JesusIsShit", "JesusIsntKing",
    "GodIsDead", "jesus.is.shit", "godsucks", "allahisfake",
    # threats / terror praise (context)
    "killalljews", "joinisis", "isisrules", "schoolshooter", "bombthem",
    # staff impersonation
    "admin", "Moderator", "DrunkPigeonsAdmin", "OfficialDrunkPigeon", "staff",
    # ordinary profanity policy (preserved)
    "fuckyou", "shithead", "cuntface",
    # zero-width / invisible bypass of a slur
    "nig\u200bger", "ni\u200dgga",
    # standalone prophet-name variants (all spellings)
    "Muhammad", "Muhammed", "Mohammed", "Mohamed", "Mohammad", "Muhamad",
    "Mohamad", "Muhamed",
    # obfuscated standalone prophet-name variants
    "M0hamed", "m u h a m m a d", "mo.ha.mmed", "Muhammmmad", "МОНАММΕD",
    # insulting combinations involving Muhammad
    "MohamedIsShit", "MuhammadSucks", "fuckmohammed", "mohammedisgay",
]

# --- Names that MUST be allowed (clean regression set) ---
CLEAN = [
    # affirming religious
    "JesusIsKing", "JesusIsGod", "GodIsGood", "JesusSaves", "GodBless",
    # ordinary words with coincidental sequences (Scunthorpe problem)
    "Scunthorpe", "Cockburn", "Analyst", "Assassin", "Class", "Passion",
    "Grape", "Therapist", "Cumberland", "Dickens", "Penistone", "Essex",
    "Sussex", "Middlesex", "Kingsman", "Kingston", "Shiitake", "Signal",
    "Morning", "Kingfisher", "Special", "Dragon", "Compass",
    # legitimate + multicultural personal names
    "Fatima", "Aisha", "Ravi", "Priya", "Wei",
    "Chen", "Kwame", "Nadia", "Sokolov", "Bjorn", "Zoe", "Jose", "Andre",
    "OConnor", "DeSouza", "MacLeod", "Gonzalez", "Nguyen", "Yamamoto",
    "Isabella", "Isadora", "Gordon", "Godfrey",
    # compound / longer names containing a prophet-name sequence must NOT be blocked
    "MuhammadAli", "MohamedSalah", "Muhammadu", "Ahmad", "Hammad", "Mohan",
    "AbdulMuhammad", "MoSalah",
    # short names with numbers (legit)
    "Kev1n", "T0mmy", "P1geon", "L33t", "Player7", "Ace99", "M8y", "Bo55",
    # game-flavoured legit names
    "FatPigeon", "DrunkBird", "ChipMonster", "PubCrawler", "PigeonKing",
    "FlappyLad", "BinChicken", "SohoScrapper", "LondonLad", "TipsyTom",
    # existing-style valid names
    "GymPigeon", "RoadmanRick", "FancyFeathers", "TouristTerry", "BusinessBob",
    "Nigel", "Niger",  # "Nigel"/country "Niger" must NOT hit the n-word family
    "assess", "grassy", "cocktail", "class1c",
]


def test_abuse_rejected():
    failed = [n for n in ABUSE if is_allowed(n)]
    assert not failed, f"abuse names wrongly ALLOWED: {failed}"


def test_clean_allowed():
    # collect reasons for any false positives to aid tuning
    fp = [(n, moderation_reason(n)) for n in CLEAN if not is_allowed(n)]
    assert not fp, f"clean names wrongly REJECTED: {fp}"


def test_counts_reported(capsys):
    print(f"abuse variants tested: {len(ABUSE)} | clean names tested: {len(CLEAN)}")
    assert len(ABUSE) >= 40 and len(CLEAN) >= 60
