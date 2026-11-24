"""CER Coach paper set: Plan, Build, Check (Quick + Full) and Steps Card.
Writes HTML, renders PDF with headless Chrome via Playwright."""
import os, sys, asyncio
from pathlib import Path

HERE = Path(__file__).resolve().parent
FONTS = HERE / "node_modules/@fontsource/atkinson-hyperlegible-next/files"
OUT = HERE / "out"   # HTML sources land here; PDFs are copied to pdf/ by hand after a check
OUT.mkdir(exist_ok=True)

def face(w):
    return (f"@font-face{{font-family:'AHN';font-weight:{w};font-style:normal;"
            f"src:url('file://{FONTS}/atkinson-hyperlegible-next-latin-{w}-normal.woff2') format('woff2');}}")

BASE_CSS = "".join(face(w) for w in (400, 600, 700, 800)) + """
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'AHN';color:#000;background:#fff;font-size:11pt;line-height:1.3}
.page{page-break-after:always;position:relative}
.page:last-child{page-break-after:auto}
.namebar{display:flex;align-items:flex-end;gap:10px;font-size:10pt;font-weight:600;margin-bottom:10px}
.namebar .fill{flex:1;border-bottom:1px solid #000;height:18px}
.namebar .pbox{width:.55in;height:.32in;border:1px solid #000}
.titlebar{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:10px}
h1{font-size:18pt;font-weight:800}
.lvl{font-size:10pt;font-weight:600}
.subhead{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #000;padding-bottom:3px;margin-bottom:10px}
h2{font-size:13pt;font-weight:700;margin:12px 0 4px}
.subhead h2{margin:0}
.q{font-weight:600;margin-top:8px}
.q .n{display:inline-block;min-width:1.4em}
.note{font-size:10pt;margin-top:2px}
.ln{height:.34in;border-bottom:1px solid #000;font-size:10.5pt;display:flex;align-items:flex-end;padding-bottom:3px}
.lines{margin-left:1.4em}
.lines.tight .ln{height:.3in}
.bank{border:1px dashed #000;padding:4px 8px;font-size:10pt;margin:6px 0 0 1.4em}
.bank b{font-weight:700}
.qbox{border:1.5px solid #000;padding:6px 10px 0}
.qbox .lab{font-weight:700;font-size:11pt}
.qbox .ln:last-child{border-bottom:none}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #000;vertical-align:top;text-align:left}
th{font-size:9.5pt;font-weight:700;padding:4px 5px;line-height:1.2}
td{font-size:10pt;padding:0 5px}
td .ln{height:.3in}
td .ln:last-child{border-bottom:none}
td.num{width:.38in;text-align:center;font-weight:700;padding-top:4px}
td.ex{font-size:10pt;padding:5px 6px;line-height:1.3}
tr.exrow td{border-style:dashed}
.circ{font-size:10.5pt;font-weight:600;letter-spacing:0;white-space:nowrap;padding-top:6px}
.checks .ck{display:flex;gap:8px;align-items:center;margin:6px 0 0 1.4em;font-size:11pt}
.checks .bx{width:.2in;height:.2in;border:1.3px solid #000;flex:none}
.small{display:inline-block;width:.38in;height:.32in;border:1px solid #000;margin-right:8px;vertical-align:middle}
.goal{font-weight:600;font-size:10.5pt;margin-top:8px}
.rung{border:1.3px solid #000;padding:3px 10px 5px;margin-top:8px}
.rung .rh{display:flex;align-items:center;gap:8px;font-weight:700;font-size:11.5pt}
.rung.ex{border-style:dashed}
.rung .q{margin-top:5px}
.exline{font-size:10.5pt;margin:2px 0 0 1.4em;border-bottom:1px solid #000;padding-bottom:2px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 .3in}
.foot{font-size:8pt;margin-top:8px}
"""

def lines(n, first="", cls=""):
    out = [f'<div class="ln">{first}</div>'] + ['<div class="ln"></div>'] * (n - 1)
    return f'<div class="lines {cls}">' + "".join(out) + "</div>"

def namebar(label="Name"):
    return (f'<div class="namebar">{label}<div class="fill"></div>Period<div class="pbox"></div></div>')

def title(t, lvl):
    return f'<div class="titlebar"><h1>{t}</h1><span class="lvl">{lvl}</span></div>'

def subhead(t, lvl):
    return f'<div class="subhead"><h2>{t}</h2><span class="lvl">{lvl}</span></div>'

def q(n, text):
    return f'<div class="q"><span class="n">{n}.</span>{text}</div>'

def doc(body, css_extra="", page="letter"):
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>@page{{size:{page};margin:.5in}}'
            f'{BASE_CSS}{css_extra}</style></head><body>{body}</body></html>')

EX_Q = "Should our school start later in the morning?"

# ---------------------------------------------------------------- PLAN
def plan(level):
    quick = level == "Quick"
    S = lambda s: s if quick else ""
    f = []
    f.append(namebar())
    f.append(title("CER Coach: Plan", level))
    f.append('<div class="qbox"><div class="lab">The Question I Am Answering</div>'
             + '<div class="ln"></div><div class="ln"></div></div>')
    f.append("<h2>Unpack the Question</h2>")
    f.append(q(1, "Circle the task word in the question. What does it ask you to do?"))
    f.append(lines(1, S("The question asks me to")))
    if quick:
        f.append('<div class="bank"><b>Task words:</b> describe &nbsp;·&nbsp; decide &nbsp;·&nbsp; '
                 'explain why &nbsp;·&nbsp; compare &nbsp;·&nbsp; judge how much &nbsp;·&nbsp; list</div>')
    f.append(q(2, "Which words or names in the question do you need to understand first?"))
    f.append(lines(1, S("Words I need to know:")))
    f.append(q(3, "Say the question in your own words."))
    f.append(lines(2, S("The question is really asking")))
    f.append("<h2>Evidence Log</h2>")
    f.append('<div class="note">Log every piece of evidence that might help. Circle how directly it answers the question: '
             '3 = proves it, 2 = helps, 1 = barely.</div>')
    rows = []
    head = ('<tr><th style="width:.38in">#</th><th>What it says or shows</th>'
            '<th style="width:1.45in">Who made the source, and when?</th>'
            '<th style="width:.95in">Where? (page, paragraph)</th>'
            '<th>What it shows about the question</th><th style="width:.7in">Strength</th></tr>')
    if quick:
        rows.append('<tr class="exrow"><td class="num">Ex.</td>'
                    '<td class="ex">Doctors say middle and high schools should start at 8:30 a.m. or later.</td>'
                    '<td class="ex">American Academy of Pediatrics, a group of children\'s doctors, 2014</td>'
                    '<td class="ex">Policy statement, opening summary</td>'
                    '<td class="ex">Experts on kids\' health think early start times are a problem.</td>'
                    '<td class="ex circ">1 &nbsp;2 &nbsp;<span style="border:1.3px solid #000;border-radius:50%;padding:0 4px">3</span></td></tr>')
    nrows = 3 if quick else 4
    cell = lambda k: '<td>' + '<div class="ln"></div>' * k + '</td>'
    for i in range(1, nrows + 1):
        rows.append(f'<tr><td class="num">{i}</td>{cell(3)}{cell(3)}{cell(3)}{cell(3)}'
                    '<td class="circ" style="text-align:center">1 &nbsp;2 &nbsp;3</td></tr>')
    f.append(f'<table style="margin-top:6px">{head}{"".join(rows)}</table>')
    if quick:
        f.append('<div class="note">The example row is about a different question: '
                 f'<i>{EX_Q}</i></div>')
    front = '<div class="page">' + "".join(f) + "</div>"

    b = []
    b.append(subhead("Claim Builder", level))
    b.append(q(4, "Answer the question in one sentence. This is your first-try claim."))
    b.append(lines(3, S("The answer is")))
    if quick:
        b.append('<div class="bank"><b>Helpful words:</b> since &nbsp;·&nbsp; which shows &nbsp;·&nbsp; '
                 'because &nbsp;·&nbsp; however &nbsp;·&nbsp; mostly &nbsp;·&nbsp; so &nbsp;·&nbsp; although</div>')
    b.append(q(5, "Test your claim. Check each box that is true. If a box is empty, fix the claim before you go on."))
    b.append('<div class="checks">'
             '<div class="ck"><div class="bx"></div>It answers the question at the top of the front page.</div>'
             '<div class="ck"><div class="bx"></div>Someone could disagree with it.</div>'
             '<div class="ck"><div class="bx"></div>Evidence from my log can prove it.</div></div>')
    if quick:
        b.append(q(6, "Who might disagree with your claim, and why? <span style='font-weight:400'>(Optional challenge)</span>"))
    else:
        b.append(q(6, "Who might disagree with your claim, and what evidence would they point to?"))
    b.append(lines(3, S("Some people might say")))
    b.append(q(7, "How would you answer them? Use your evidence."))
    b.append(lines(3, S("But")))
    b.append(q(8, "Rewrite your claim. Make it stronger or more exact if your evidence pushed it somewhere new."))
    b.append(lines(3, S("My final claim:")))
    b.append(q(9, "Which rows from your Evidence Log prove your claim best? Write the row numbers, strongest first."))
    k = 2 if quick else 3
    b.append('<div style="margin:6px 0 0 1.4em">' + '<span class="small"></span>' * k + '</div>')
    b.append(q(10, "Why is your first choice the strongest?"))
    b.append(lines(4, S("Row")))
    back = '<div class="page">' + "".join(b) + "</div>"
    return doc(front + back)

# ---------------------------------------------------------------- BUILD
def build(level):
    quick = level == "Quick"
    S = lambda s: s if quick else ""
    f = []
    f.append(namebar())
    f.append(title("CER Coach: Build", level))
    f.append('<div class="qbox"><div class="lab">My Claim</div><div class="ln"></div><div class="ln"></div></div>')
    f.append("<h2>Reasoning Ladder</h2>")
    f.append('<div class="note">One rung for each piece of evidence you chose. Climb from what it says to why it proves your claim.</div>')
    if quick:
        f.append('<div class="rung ex"><div class="rh">Example: ' + EX_Q + '</div>'
                 '<div class="exline"><b>Evidence:</b> Children\'s doctors (AAP, 2014) say schools should start at 8:30 a.m. or later.</div>'
                 '<div class="exline"><b>This shows</b> that the experts on kids\' health think early starts are a problem.</div>'
                 '<div class="exline"><b>This proves my claim because</b> the people who study kids\' health the most are warning against early starts.</div>'
                 '<div class="exline" style="border-bottom:none"><b>This connects to</b> what experts know about how much sleep teens need.</div></div>')
    n_rungs = 2 if quick else 3
    for i in range(1, n_rungs + 1):
        r = [f'<div class="rung"><div class="rh">Evidence <span class="small" style="margin:0"></span>'
             '<span style="font-weight:400;font-size:10pt">row from your log</span></div>']
        r.append('<div class="grid2"><div>' + q("a", "What does the evidence say?") + lines(2, S("According to"), "tight")
                 + '</div><div>' + q("b", "What does this show?") + lines(2, S("This shows that"), "tight") + '</div></div>')
        r.append('<div class="grid2"><div>' + q("c", "Why does it prove your claim?") + lines(2, S("This proves my claim because"), "tight")
                 + '</div><div>' + q("d", "Which idea or word from class does it connect to?") + lines(2, S("This connects to"), "tight") + '</div></div>')
        r.append("</div>")
        f.append("".join(r))
    front = '<div class="page">' + "".join(f) + "</div>"

    b = [subhead("CER Outline", level)]
    goal = ("Claim, one sentence » Evidence and reasoning for 2 pieces » Return to your claim. Aim for 6 to 8 sentences."
            if quick else
            "Claim, one sentence » Evidence and reasoning for 3 pieces » Counterpoint and answer » Return to your claim. Aim for 9 to 12 sentences.")
    b.append(f'<div class="goal">{goal}</div>')
    b.append('<div class="note">Plan here in short phrases. Write the finished CER on lined paper.</div>')
    b.append("<h2>Claim</h2>")
    b.append(lines(2, S("The answer is")))
    k = 2 if quick else 3
    for i in range(1, k + 1):
        b.append(f"<h2>Evidence {i} and Reasoning</h2>")
        b.append(lines(1, S("According to")))
        b.append(lines(3 if quick else 2, S("This proves my claim because")))
    if quick:
        b.append('<h2>Counterpoint <span style="font-weight:400;font-size:10.5pt">(optional challenge)</span></h2>')
        b.append(lines(2, S("Some people might say")))
    else:
        b.append("<h2>Counterpoint and Answer</h2>")
        b.append(lines(3))
    b.append("<h2>Return to Your Claim</h2>")
    b.append(lines(2, S("So,")))
    if quick:
        b.append('<div class="bank" style="margin-left:0;margin-top:10px"><b>Helpful words:</b> shows &nbsp;·&nbsp; '
                 'for example &nbsp;·&nbsp; proves &nbsp;·&nbsp; this means &nbsp;·&nbsp; because &nbsp;·&nbsp; '
                 'also &nbsp;·&nbsp; in the end &nbsp;·&nbsp; however</div>')
    back = '<div class="page">' + "".join(b) + "</div>"
    return doc(front + back)

# ---------------------------------------------------------------- CHECK (half sheet)
CHECK_CSS = """
.sheet{display:flex;height:7.45in}
.panel{width:50%;padding:0 .28in}
.panel:first-child{padding-left:0;border-right:1.3px dashed #000}
.panel:last-child{padding-right:0}
.panel h1{font-size:15pt}
.panel table th{font-size:9pt}
.panel table td{font-size:9.5pt}
.panel .q{font-size:10.5pt;margin-top:7px}
.panel ul{margin:3px 0 0 2.6em;font-size:10.5pt}
.panel li{margin:1px 0}
.sc{white-space:nowrap;font-weight:600;font-size:9.5pt;text-align:center;padding-top:5px!important}
.panel td .ln{height:.28in}
"""
def check_panel(level):
    quick = level == "Quick"
    ev = "2 pieces" if quick else "3 pieces"
    rows = [
        ("Claim", "Answers the question. Someone could disagree."),
        ("Evidence", f"{ev}, each with where it came from."),
        ("Reasoning", "Says why each piece proves the claim, not just what it says."),
    ]
    if not quick:
        rows.append(("Counterpoint", "Names who would disagree and answers them."))
    rows.append(("Finish", "Returns to the claim. Complete sentences."))
    tr = "".join(
        f'<tr><td style="font-weight:700;padding-top:4px;width:.85in">{a}</td>'
        f'<td style="padding-top:4px">{b_}<div class="ln" style="font-size:8.5pt;height:.3in">Proof:</div></td>'
        '<td class="sc">4 3 2 1</td><td class="sc">4 3 2 1</td></tr>'
        for a, b_ in rows)
    p = [namebar(), f'<div class="titlebar"><h1>CER Coach: Check</h1><span class="lvl">{level}</span></div>']
    p.append(q(1, "Score your own CER first. Copy a few of your words as proof. Then trade with a partner."))
    p.append('<table style="margin-top:5px"><tr><th>Part</th><th>Check for this</th>'
             '<th style="width:.62in">Me</th><th style="width:.62in">Partner</th></tr>' + tr + "</table>")
    p.append(q(2, "Partner Read: your partner reads your CER out loud, then asks you:"))
    qs = ["What question does your claim answer?", "Where did this evidence come from?",
          "Why does that prove your claim?"]
    if not quick:
        qs.append("Who would disagree, and what is your answer?")
    p.append("<ul>" + "".join(f"<li>{x}</li>" for x in qs) + "</ul>")
    p.append(q(3, "What is one thing you will fix before you turn it in?"))
    p.append(lines(2, S_q(quick)))
    p.append('<div class="namebar" style="margin-top:8px">Partner<div class="fill"></div></div>')
    p.append('<div class="foot">4 Exemplary · 3 Proficient · 2 Progressing · 1 Beginning</div>')
    return '<div class="panel">' + "".join(p) + "</div>"

def S_q(quick):
    return "I will fix" if quick else ""

def check(level):
    pan = check_panel(level)
    return doc(f'<div class="sheet">{pan}{pan}</div>', CHECK_CSS, "letter landscape")

# ---------------------------------------------------------------- STEPS CARD (glue-in)
STEPS = [
    ("Read the question.", ["What is it really asking me to do?", "Which words do I need to understand?"]),
    ("Find the evidence.", ["What do the sources say or show?", "Who made each source, and when?", "Where can someone find it?"]),
    ("Answer it.", ["Does my claim answer the question?", "Could someone disagree?", "Can my evidence prove it?"]),
    ("Prove it.", ["Which evidence proves my claim most directly?", "Did I say where it came from?"]),
    ("Explain why.", ["What does this evidence show?", "Why does it prove my claim?", "What idea from class does it connect to?"]),
    ("Check it.", ["Who would disagree, and what is my answer?", "Did I return to my claim?", "Would a partner follow it?"]),
]
CARD_CSS = """
.sheet{display:flex;height:7.45in}
.half{width:50%;padding:0 .35in}
.half:first-child{padding-left:0;border-right:1px dotted #000}
.half:last-child{padding-right:0}
.step{display:flex;gap:10px;margin-top:9px}
.step .num{font-size:20pt;font-weight:800;line-height:1;width:.35in}
.step .t{font-size:13pt;font-weight:700}
.step ul{margin:2px 0 0 1.1em;font-size:11pt}
.cover{display:flex;flex-direction:column;justify-content:flex-start}
.glue{display:flex;align-items:center;justify-content:center;height:100%;font-size:12pt;font-weight:600;border:1px dashed #000}
"""
def steps_card():
    left = ['<h1 style="font-size:17pt">CER Coach: The Six Steps</h1>'
            '<div class="note" style="margin-top:4px;font-size:11pt">Read the question. Find the evidence. Answer it. Prove it. Explain why. Check it.</div>']
    right = ['<h1 style="font-size:17pt">Questions to Ask Yourself</h1>']
    for i, (t, qs) in enumerate(STEPS, 1):
        blk = (f'<div class="step"><div class="num">{i}</div><div><div class="t">{t}</div>'
               + "<ul>" + "".join(f"<li>{x}</li>" for x in qs) + "</ul></div></div>")
        (right if True else left).append(blk)
    # left half: the plain-language move names with C / E / R mapping
    left.append('<h2 style="margin-top:18px">Where C, E and R Fit</h2>')
    left.append('<table style="margin-top:6px"><tr><th>Part</th><th>Steps</th><th>What it does</th></tr>'
                '<tr><td style="padding:5px;font-weight:700">Claim</td><td style="padding:5px">3</td><td style="padding:5px">Answers the question in one sentence someone could disagree with.</td></tr>'
                '<tr><td style="padding:5px;font-weight:700">Evidence</td><td style="padding:5px">2, 4</td><td style="padding:5px">Facts, quotes or details from sources, with where they came from.</td></tr>'
                '<tr><td style="padding:5px;font-weight:700">Reasoning</td><td style="padding:5px">5</td><td style="padding:5px">Explains why the evidence proves the claim, using ideas from class.</td></tr>'
                '<tr><td style="padding:5px;font-weight:700">Counterpoint</td><td style="padding:5px">6</td><td style="padding:5px">Names who would disagree and answers them.</td></tr></table>')
    front = (f'<div class="page"><div class="sheet"><div class="half">{"".join(left)}</div>'
             f'<div class="half">{"".join(right)}</div></div></div>')
    cover = ('<h1 style="font-size:20pt">CER Coach Steps Card</h1>'
             '<div class="q" style="margin-top:14px">Write the six steps from memory. Then open the card and check.</div>'
             + "".join(f'<div class="ln" style="height:.42in"><b style="margin-right:8px">{i}.</b></div>' for i in range(1, 7)))
    back = ('<div class="page"><div class="sheet">'
            f'<div class="half cover">{cover}</div>'
            '<div class="half"><div class="glue">Glue this half into your notebook.</div></div></div></div>')
    return doc(front + back, CARD_CSS, "letter landscape")

# ---------------------------------------------------------------- render
JOBS = {
    "CER Coach - Plan - Quick": lambda: plan("Quick"),
    "CER Coach - Plan - Full": lambda: plan("Full"),
    "CER Coach - Build - Quick": lambda: build("Quick"),
    "CER Coach - Build - Full": lambda: build("Full"),
    "CER Coach - Check - Quick": lambda: check("Quick"),
    "CER Coach - Check - Full": lambda: check("Full"),
    "CER Coach - Steps Card": steps_card,
}

async def main(only=None):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        chrome = os.environ.get("CHROME")  # optional path to a Chrome binary
        br = await p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else await p.chromium.launch()
        pg = await br.new_page()
        for name, fn in JOBS.items():
            if only and only not in name:
                continue
            html = OUT / f"{name}.html"
            html.write_text(fn(), encoding="utf-8")
            await pg.goto(f"file://{html}")
            await pg.evaluate("document.fonts.ready")
            fam = await pg.evaluate("[...document.fonts].filter(f=>f.status==='loaded').length")
            await pg.pdf(path=str(OUT / f"{name}.pdf"), prefer_css_page_size=True, print_background=True)
            print(name, "fonts loaded:", fam)
        await br.close()

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else None))
