#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yfirlestur — íslensk málfarsskoðun á notendatexta Lifeline.

Keyrir GreynirCorrect (Miðeind, sama vél og yfirlestur.is) yfir þann texta sem
skjólstæðingur eða hjúkrunarfræðingur sér í raun: JSX-texta, merkingar, hnappa
og íslenska strengi í .ts/.tsx, ásamt .md og .json.

    python3 scripts/yfirlestur.py src/app/components/hc/*.tsx
    python3 scripts/yfirlestur.py --all
    python3 scripts/yfirlestur.py --all --tolur     # líka tölfræði um þekjuna

Uppsetning (einu sinni):

    pip install --break-system-packages --target scripts/.islib reynir-correct

Skilar 1 ef athugasemdir finnast, svo þetta megi nota í CI.

──────────────────────────────────────────────────────────────────────────────
AF HVERJU EIGIN ÚTDRÁTTUR

Fjarlaekningar/scripts/yfirlestur.py les .ts-skrár með því að taka alla langa
strengi sem innihalda íslenskan bókstaf. Það gengur upp á efnisskrám eins og
erindi.ts, en á React-íhlut dregur það inn gerðaskilgreiningar, enskar
skýringar og Tailwind-klasa — og þá drukknar raunveruleg villa í hundrað
fölskum. Hér eru skýringar og kóði fjarlægð fyrst og aðeins notendatexti
skilinn eftir.

TAKMARKANIR

Vélin þekkir ekki orðaforða okkar og les hvorki JSX né kóða til fulls. Þess
vegna eru þrjár síur: ORÐALISTI fyrir orð sem eru rétt en ekki í BÍN, SKIP_CODES
fyrir reglur sem eiga ekki við, og útdráttur sem sleppir öllu sem lítur út eins
og kóði. Athugasemd er tilefni til að lesa línuna, ekki skipun.
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Safnið er þungt; notum það sem er til, hvort sem það er hér eða í hinni geymslunni.
for cand in (os.path.join(HERE, ".islib"), "/home/mads/Fjarlaekningar/scripts/.islib"):
    if os.path.isdir(cand):
        sys.path.insert(0, cand)
        break

try:
    from reynir_correct import check
except ImportError:
    sys.exit(
        "GreynirCorrect vantar. Settu upp með:\n"
        "  pip install --break-system-packages --target scripts/.islib reynir-correct"
    )

# Kóðar sem segja ekkert um íslenskuna sjálfa í okkar texta.
SKIP_CODES = {
    "E001", "U001",   # óþekkt orð — fagorð eru ekki í BÍN
    "E004",           # "sennilega ekki á íslensku" — á við um stök heiti
    "E005",           # "málsgrein í lengra lagi" — á við um upptalningar
    "S004",           # "leiðrétti" enskt orð í íslenskt — vöruheiti og kóðaleifar
    "W001/w",         # enskt orð "gæti átt að vera" annað enskt orð
    "E006",           # "skammstafanir ætti að skrifa út" — „t.d." er fullgilt
}

# Reglur sem eiga aðeins við um heilar málsgreinar. Merking á hnappi er ekki
# málsgrein og á hvorki að byrja á hástaf né enda á punkti, svo þessar reglur
# eru felldar niður á textabútum.
BUTA_KODAR = {"Z002", "P_NT_Komma/w"}

# Orð sem eru rétt hjá okkur þótt vélin þekki þau ekki.
ORDALISTI = {
    # kerfi og vörur
    "Lifeline", "Medalia", "Biody", "vinnustöð", "vinnustöðin", "vinnustöðina",
    "Grunnheilsa", "Grunnheilsu", "heilsuferð", "heilsuferðin", "heilsuferðina",
    "sjúklingagátt", "sjúklingagáttinni", "heilsugæsla", "heilsugæslu",
    "lyfjagátt", "innskráning", "útskráning", "smáforrit", "smáforritinu",
    # skjólstæðingar og starfsfólk
    "skjólstæðingur", "skjólstæðingi", "skjólstæðingnum", "skjólstæðings",
    "skjólstæðingar", "skjólstæðinga", "skjólstæðingum", "hjúkrunarfræðingur",
    "hjúkrunarfræðingi", "hjúkrunarfræðings", "næringarfræðingur", "sjúkraþjálfari",
    # mælingar og einkunnir
    "lífstílseinkunn", "lífstílseinkunnin", "efnaskiptaheilsa", "efnaskiptaheilsu",
    "hjartaheilsa", "hjartaheilsu", "líkamssamsetning", "líkamssamsetningu",
    "fitumassi", "fitumassa", "vöðvamassi", "vöðvamassa", "blóðþrýstingur",
    "blóðþrýsting", "blóðþrýstings", "blóðsykur", "blóðsykri", "blóðsykurs",
    "insúlín", "insúlíns", "kólesteról", "kólesteróli", "þríglýseríð",
    "lifrarensím", "langtímasykur", "blóðfitur", "blóðprufa", "blóðprufu",
    "blóðrannsókn", "endurmat", "endurmæling", "viðmiðunargildi", "viðmiðabil",
    "þolmæling", "hámarkspúls", "kaloríur", "kaloríum", "næringarefni",
    # stoðirnar og aðgerðir
    "lífsstílsáætlun", "lífsstílsáætlunin", "lífsstílsáætluninni", "aðgerðaáætlun",
    "matarhegðun", "skjánotkun", "fjárhættuspil", "nikótín", "nikótíns",
    "koffín", "koffíns", "hreyfiseðill", "svefnvenjur", "svefnvenja",
    "andleg", "vellíðan", "vellíðunar", "streita", "streitu", "eftirfylgd",
    "þolþjálfun", "styrktarþjálfun", "hnébeygja", "mjaðmalyfta", "réttstöðulyfta",
    "millirifjaþjálfun", "upphitun", "niðurlag", "æfingasafn", "æfingasafni",
    # tækni
    "innhleðsla", "gagnagrunnur", "gagnagrunni", "vafra", "vafranum",
    "smáskilaboð", "myndsamtal", "myndsamtali", "tímabókun", "tímabókunar",
}

ICELANDIC = re.compile(r"[þæðöáíóúýÞÆÐÖÁÍÓÚÝéÉ]")

# Það sem á að vera kóði en ekki texti.
CODEISH = re.compile(
    r"=>|&&|\|\||=== |!== |\bclassName\b|\bconst\b|\breturn\b|\bimport\b|\bexport\b"
    r"|\binterface\b|\btype \w+ =|\bfunction\b|\bawait\b|\bnull\b|\bundefined\b"
    r"|\{|\}|\$\{|</|/>|\bpx-|\btext-|\bbg-|\brounded-|\bflex\b|\bgrid\b"
    r"|https?://|\bapi/|\.tsx?\b|[a-z]+_[a-z]+|[a-z]+-[a-z]+-[a-z]+"
)


def _strip_code_comments(text):
    """Skýringar í kóða eru á ensku og eiga ekkert erindi í yfirlestur."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return text


def _sentences(s):
    """Hreinsar einn streng og skilar (texti, er_buti) sé hann íslenskur
    notendatexti. Bútur er merking eða hnappur sem endar ekki á greinarmerki —
    vélin les hann sem málsgrein og kvartar þá undan hástaf sem á ekki að vera."""
    s = s.replace("\\n", " ").replace("\\\"", '"').strip()
    s = re.sub(r"\s+", " ", s)
    if len(s) < 12 or not ICELANDIC.search(s):
        return []
    if " " not in s or CODEISH.search(s):
        return []
    if s.isupper():
        return []
    buti = not re.search(r"[.!?]$", s)
    if buti:
        s += "."
    return [(s, buti)]


def _from_tsx(text):
    """Notendatexti úr React-íhlut: JSX-texti og íslenskir strengir."""
    text = _strip_code_comments(text)
    out = []
    # JSX-textahnútar: >texti<  (engar slaufur, þ.e. enginn innskotinn kóði)
    for m in re.findall(r">\s*([^<>{}\n][^<>{}]*?)\s*<", text):
        out.extend(_sentences(m))
    # Strengir: "…", '…', `…` (sleppum þeim sem hafa ${})
    for m in re.findall(r'"([^"\\\n]{12,600})"', text):
        out.extend(_sentences(m))
    for m in re.findall(r"'([^'\\\n]{12,600})'", text):
        out.extend(_sentences(m))
    for m in re.findall(r"`([^`\\$]{12,1200})`", text):
        out.extend(_sentences(m))
    return out


def _from_markdownish(text):
    out = []
    for block in re.split(r"\n\s*\n", text):
        s = block.strip()
        if not s or s.startswith("```") or s.startswith("|"):
            continue
        s = re.sub(r"^#+\s*", "", s, flags=re.M)
        s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
        s = re.sub(r"`[^`]*`", "", s)
        s = re.sub(r"https?://\S+", "", s)
        s = s.replace("**", "").replace("*", "").replace(">", "")
        for line in re.split(r"(?<=[.!?])\s+", s.replace("\n", " ")):
            out.extend(_sentences(line))
    return out


def units(path):
    text = open(path, encoding="utf-8").read()
    ext = os.path.splitext(path)[1]
    if ext == ".json":
        out = []

        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if isinstance(v, str) and k in ("text", "title", "description", "label", "body", "summary"):
                        out.extend(_sentences(v))
                    else:
                        walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)

        walk(json.loads(text))
        return out
    if ext in (".ts", ".tsx"):
        return _from_tsx(text)
    return _from_markdownish(text)


def suppressed(annotation_text, sentence):
    """Fellur athugasemdin á orði sem er rétt hjá okkur, eða á reglu sem á ekki við?

    Tvípunktur: á íslensku heldur málsgrein áfram með lágstaf eftir tvípunkt, en
    tókarinn les tvípunkt sem endi og heimtar hástaf. Sú athugasemd er alltaf
    röng í okkar texta."""
    words = set(re.findall(r"[\wÞÆÐÖÁÍÓÚÝþæðöáíóúýéÉ]+", annotation_text))
    if words & ORDALISTI:
        return True
    low = {w.lower() for w in words}
    if low & {w.lower() for w in ORDALISTI}:
        return True
    if "hástaf" in annotation_text and ":" in str(sentence):
        return True
    return False


DEFAULT_TARGETS = [
    "src/app/vinnustod/*.tsx",
    "src/app/components/hc/*.tsx",
    "src/lib/hc/*.ts",
    "src/app/account/**/*.tsx",
    "src/lib/site-content/*.ts",
]


def main(argv):
    stats = "--tolur" in argv
    argv = [a for a in argv if a != "--tolur"]
    if not argv or argv[0] == "--all":
        root = os.path.dirname(HERE)
        paths = []
        for pat in DEFAULT_TARGETS:
            paths += glob.glob(os.path.join(root, pat), recursive=True)
    else:
        paths = argv

    total, sentences = 0, 0
    for path in sorted(set(paths)):
        try:
            us = units(path)
        except Exception as exc:                      # noqa: BLE001 - report and move on
            print(f"\n=== {os.path.basename(path)}\n   (slepp: {exc})")
            continue
        sentences += len(us)
        hits = []
        for unit, buti in us:
            for para in check(unit):
                for sent in para:
                    for a in sent.annotations:
                        if a.code in SKIP_CODES or suppressed(a.text, sent):
                            continue
                        if buti and a.code in BUTA_KODAR:
                            continue
                        hits.append((a.code, a.text, str(sent)[:110]))
        if hits:
            print(f"\n=== {os.path.relpath(path)}  ({len(us)} málsgreinar)")
            for code, txt, ctx in hits:
                total += 1
                print(f"   [{code}] {txt}\n        …{ctx}")

    if stats:
        print(f"\nÞekja: {sentences} málsgreinar úr {len(set(paths))} skrám.")
    print(f"\nAthugasemdir: {total}")
    if total:
        print("Lestu hverja línu — vélin þekkir ekki boðhátt né fagorð.")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
