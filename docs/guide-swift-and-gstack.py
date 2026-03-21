#!/usr/bin/env python3
"""Generate the Swift + gstack Claude Code guide PDF."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import os

OUTPUT = os.path.join(os.path.dirname(__file__), "Swift_and_gstack_Guide.pdf")

# Colors
DARK = HexColor("#1a1a2e")
ACCENT = HexColor("#e94560")
BLUE = HexColor("#0a81ab")
LIGHT_BG = HexColor("#f5f5f7")
MID_GRAY = HexColor("#6b7280")
CODE_BG = HexColor("#f0f0f4")
GREEN = HexColor("#10b981")
ORANGE = HexColor("#f59e0b")

# Styles
styles = {
    "title": ParagraphStyle("Title", fontSize=28, leading=34, textColor=DARK,
                            fontName="Helvetica-Bold", spaceAfter=6),
    "subtitle": ParagraphStyle("Subtitle", fontSize=14, leading=18, textColor=MID_GRAY,
                               fontName="Helvetica", spaceAfter=24),
    "h1": ParagraphStyle("H1", fontSize=20, leading=26, textColor=DARK,
                         fontName="Helvetica-Bold", spaceBefore=20, spaceAfter=10),
    "h2": ParagraphStyle("H2", fontSize=15, leading=20, textColor=BLUE,
                         fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6),
    "h3": ParagraphStyle("H3", fontSize=12, leading=16, textColor=DARK,
                         fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4),
    "body": ParagraphStyle("Body", fontSize=10, leading=14, textColor=DARK,
                           fontName="Helvetica", spaceAfter=6),
    "bold": ParagraphStyle("Bold", fontSize=10, leading=14, textColor=DARK,
                           fontName="Helvetica-Bold", spaceAfter=6),
    "code": ParagraphStyle("Code", fontSize=9, leading=13, textColor=DARK,
                           fontName="Courier", backColor=CODE_BG,
                           leftIndent=12, spaceAfter=6,
                           borderPadding=(4, 6, 4, 6)),
    "bullet": ParagraphStyle("Bullet", fontSize=10, leading=14, textColor=DARK,
                             fontName="Helvetica", leftIndent=20, spaceAfter=3,
                             bulletIndent=8, bulletFontName="Helvetica"),
    "caption": ParagraphStyle("Caption", fontSize=8, leading=11, textColor=MID_GRAY,
                              fontName="Helvetica-Oblique", alignment=TA_CENTER, spaceAfter=10),
    "footer": ParagraphStyle("Footer", fontSize=8, leading=10, textColor=MID_GRAY,
                             fontName="Helvetica", alignment=TA_CENTER),
}

def hr():
    return HRFlowable(width="100%", thickness=1, color=HexColor("#e5e7eb"),
                      spaceAfter=10, spaceBefore=6)

def bullet(text):
    return Paragraph(f"<bullet>&bull;</bullet> {text}", styles["bullet"])

def code(text):
    return Paragraph(text.replace(" ", "&nbsp;").replace("\n", "<br/>"), styles["code"])

def make_table(data, col_widths=None, header=True):
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    cmds = [
        ("TEXTCOLOR", (0, 0), (-1, -1), DARK),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
    ]
    if header:
        cmds += [
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    t.setStyle(TableStyle(cmds))
    return t

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=letter,
                            leftMargin=0.75*inch, rightMargin=0.75*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    story = []
    W = doc.width

    # ── COVER ──
    story.append(Spacer(1, 1.5*inch))
    story.append(Paragraph("Swift Skills + gstack", styles["title"]))
    story.append(Paragraph("A practical guide to using both together with Claude Code", styles["subtitle"]))
    story.append(hr())
    story.append(Spacer(1, 12))
    story.append(Paragraph("Your setup has two complementary skill sets:", styles["body"]))
    story.append(Spacer(1, 6))

    cover_data = [
        ["Layer", "Skills", "What They Handle"],
        ["Swift Code\nCorrectness",
         "swiftui-pro\nswift-testing-pro\nswift-concurrency-pro",
         "API best practices, deprecated code,\nconcurrency bugs, test patterns"],
        ["Dev Workflow\n& Process",
         "gstack (/review, /qa,\n/ship, /investigate, etc.)",
         "Code review process, QA testing,\nshipping PRs, design audit, retros"],
    ]
    story.append(make_table(cover_data, col_widths=[W*0.2, W*0.35, W*0.45]))
    story.append(Spacer(1, 18))
    story.append(Paragraph("<b>They never conflict.</b> Swift skills know Swift APIs. gstack knows the development process. Each stays in its lane.", styles["body"]))
    story.append(PageBreak())

    # ── PAGE 2: HOW THEY WORK TOGETHER ──
    story.append(Paragraph("How They Work Together", styles["h1"]))
    story.append(hr())

    story.append(Paragraph("The Sprint Flow", styles["h2"]))
    story.append(Paragraph("gstack runs your sprint. Swift skills advise on Swift-specific code. Here's when each activates:", styles["body"]))

    flow_data = [
        ["Phase", "You Type", "What Happens"],
        ["Think", "/office-hours", "gstack reframes your idea (Swift skills not involved)"],
        ["Plan", "/plan-ceo-review\n/plan-eng-review\n/plan-design-review",
         "gstack reviews strategy, architecture, design\n(Swift skills not involved at plan stage)"],
        ["Build", "Write SwiftUI code", "swiftui-pro activates automatically when Claude\nreads/writes .swift files with SwiftUI imports"],
        ["Build", "Write async/await code", "swift-concurrency-pro activates for\nconcurrency patterns, actor isolation, task groups"],
        ["Review", "/review", "gstack runs code review process.\nSwift skills inform Swift-specific findings."],
        ["Test", "/qa", "gstack runs QA. Detects Swift Testing / XCTest.\nDefers to swift-testing-pro for test guidance."],
        ["Ship", "/ship", "gstack handles PR creation, version bump,\nchangelog. Swift test detection built in."],
    ]
    story.append(make_table(flow_data, col_widths=[W*0.1, W*0.22, W*0.68]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Key Point: Automatic Activation", styles["h3"]))
    story.append(Paragraph("You don't need to invoke Swift skills manually. Claude reads their descriptions and activates them when it encounters Swift code. gstack skills are invoked explicitly via slash commands (/review, /qa, /ship).", styles["body"]))

    story.append(PageBreak())

    # ── PAGE 3: ARCHITECTURE DIAGRAM ──
    story.append(Paragraph("Architecture: What Lives Where", styles["h1"]))
    story.append(hr())

    story.append(Paragraph("File Locations", styles["h2"]))

    loc_data = [
        ["Location", "Contents", "Scope"],
        ["~/.claude/skills/swiftui-pro/", "SKILL.md + 9 reference files\n(api.md, views.md, data.md, etc.)", "All Swift projects"],
        ["~/.claude/skills/swift-testing-pro/", "SKILL.md + 5 reference files\n(core-rules.md, async-tests.md, etc.)", "All Swift projects"],
        ["~/.claude/skills/swift-concurrency-pro/", "SKILL.md + 12 reference files\n(actors.md, hotspots.md, etc.)", "All Swift projects"],
        ["~/.claude/skills/gstack/", "22 skill folders + browse binary\n+ reference files + lib/", "All projects\n(language-agnostic)"],
    ]
    story.append(make_table(loc_data, col_widths=[W*0.32, W*0.4, W*0.28]))
    story.append(Spacer(1, 14))

    story.append(Paragraph("How Claude Discovers Skills", styles["h2"]))
    story.append(Spacer(1, 4))

    disc_data = [
        ["Step", "What Happens"],
        ["1. Session starts", "Claude loads all skill descriptions (frontmatter only, not full content)"],
        ["2. You type a request", "Claude scans descriptions to find matching skills"],
        ["3. Skill activates", "Claude reads the full SKILL.md + any reference files it needs"],
        ["4. Progressive disclosure", "Reference files (browse/reference/commands.md, etc.) are\nread on demand, not loaded upfront"],
    ]
    story.append(make_table(disc_data, col_widths=[W*0.22, W*0.78]))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Token Budget", styles["h2"]))
    story.append(Paragraph("Swift skills are extremely lightweight (~100 lines per SKILL.md) with heavy reference files read on demand. gstack skills are larger (300-900 lines) but use progressive disclosure for command tables, test bootstrap, and snapshot flags. Together, the upfront context cost is modest.", styles["body"]))

    story.append(PageBreak())

    # ── PAGE 4: THE CRITICAL INTEGRATION POINT ──
    story.append(Paragraph("The Critical Integration Point: Testing", styles["h1"]))
    story.append(hr())

    story.append(Paragraph("This is where the two systems could have conflicted. It's fixed.", styles["body"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("The Problem (Before Fix)", styles["h2"]))
    story.append(bullet("gstack's test bootstrap only knew about web frameworks (vitest, jest, pytest, rspec)"))
    story.append(bullet("On a Swift project, /ship or /qa would try to install JavaScript test tools"))
    story.append(bullet("swift-testing-pro knows Swift Testing (structs, #expect, #require) but gstack didn't"))
    story.append(Spacer(1, 8))

    story.append(Paragraph("The Fix (Current State)", styles["h2"]))
    story.append(bullet("gstack now detects Package.swift, .xcodeproj, .xcworkspace"))
    story.append(bullet("Scans for import XCTest, import Testing, @Test in Tests/ directories"))
    story.append(bullet("When Swift tests found: prints 'Swift test target detected' and defers to swift-testing-pro"))
    story.append(bullet("Swift Testing added to framework knowledge table"))
    story.append(bullet("Tests/ directory (Swift convention) added to infrastructure scan"))
    story.append(Spacer(1, 10))

    story.append(Paragraph("What Happens Now", styles["h3"]))

    fix_data = [
        ["Scenario", "gstack Does", "Swift Skill Does"],
        ["Swift project with tests", "Detects Swift tests,\nskips bootstrap, defers", "Provides Swift Testing\nbest practices"],
        ["Swift project, no tests", "Offers to bootstrap with\nSwift Testing (not jest!)", "Advises on test structure\nwhen tests are written"],
        ["Web project (Node/Ruby/etc)", "Bootstraps vitest/jest/rspec\nas before", "Not activated\n(no Swift code)"],
        ["Mixed project", "Detects both runtimes,\nasks which to bootstrap", "Activates for .swift\nfiles only"],
    ]
    story.append(make_table(fix_data, col_widths=[W*0.22, W*0.39, W*0.39]))

    story.append(PageBreak())

    # ── PAGE 5: DAILY WORKFLOWS ──
    story.append(Paragraph("Daily Workflows", styles["h1"]))
    story.append(hr())

    story.append(Paragraph("Workflow 1: Build a New SwiftUI Feature", styles["h2"]))
    story.append(code("/office-hours"))
    story.append(Paragraph("Describe what you're building. gstack reframes the problem.", styles["body"]))
    story.append(code("/plan-eng-review"))
    story.append(Paragraph("Architecture review. Diagrams, edge cases, test strategy.", styles["body"]))
    story.append(code("[write SwiftUI code]"))
    story.append(Paragraph("swiftui-pro activates automatically. Checks deprecated APIs, data flow, accessibility.", styles["body"]))
    story.append(code("/review"))
    story.append(Paragraph("gstack reviews the PR. Swift-informed findings (if .swift files changed).", styles["body"]))
    story.append(code("/ship"))
    story.append(Paragraph("gstack detects Swift tests, runs them, creates PR.", styles["body"]))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Workflow 2: Fix a Concurrency Bug", styles["h2"]))
    story.append(code("/investigate"))
    story.append(Paragraph("gstack's root-cause debugging. 3-strike rule, scope lock.", styles["body"]))
    story.append(code("[Claude reads async/await code]"))
    story.append(Paragraph("swift-concurrency-pro activates. Checks actor reentrancy, cancellation, task groups.", styles["body"]))
    story.append(code("/qa"))
    story.append(Paragraph("gstack runs QA. swift-testing-pro advises on async test patterns.", styles["body"]))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Workflow 3: Review Someone's PR", styles["h2"]))
    story.append(code("/review"))
    story.append(Paragraph("gstack runs two-pass review (critical first, informational second). For .swift files, Swift skills inform findings: deprecated APIs, concurrency issues, test quality.", styles["body"]))

    story.append(PageBreak())

    # ── PAGE 6: WHAT EACH SKILL SET COVERS ──
    story.append(Paragraph("Coverage Map", styles["h1"]))
    story.append(hr())
    story.append(Paragraph("What each system handles. Green = covered. This shows they're complementary, not competing.", styles["body"]))
    story.append(Spacer(1, 8))

    cov_data = [
        ["Concern", "Swift Skills", "gstack"],
        ["SwiftUI API correctness", "YES", "no"],
        ["Deprecated API detection", "YES", "no"],
        ["Swift concurrency bugs", "YES", "no"],
        ["Swift Testing patterns", "YES", "no"],
        ["Apple HIG compliance", "YES", "no"],
        ["Accessibility (VoiceOver, Dynamic Type)", "YES", "partial (design review)"],
        ["Code review process", "no", "YES (/review)"],
        ["QA browser testing", "no", "YES (/qa, /browse)"],
        ["PR creation & shipping", "no", "YES (/ship)"],
        ["Design system audit", "no", "YES (/design-review)"],
        ["Strategic plan review", "no", "YES (/plan-ceo-review)"],
        ["Root-cause debugging", "no", "YES (/investigate)"],
        ["Weekly retrospective", "no", "YES (/retro)"],
        ["Safety guardrails", "no", "YES (/careful, /guard)"],
        ["Test framework detection", "Swift-specific", "All runtimes + Swift"],
    ]
    t = Table(cov_data, colWidths=[W*0.42, W*0.29, W*0.29], hAlign="LEFT")
    cmds = [
        ("TEXTCOLOR", (0, 0), (-1, -1), DARK),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ]
    # Color YES cells green, NO cells light
    for row in range(1, len(cov_data)):
        for col in [1, 2]:
            val = cov_data[row][col].lower()
            if val.startswith("yes"):
                cmds.append(("BACKGROUND", (col, row), (col, row), HexColor("#d1fae5")))
            elif val == "no":
                cmds.append(("BACKGROUND", (col, row), (col, row), HexColor("#f3f4f6")))
                cmds.append(("TEXTCOLOR", (col, row), (col, row), MID_GRAY))
            elif val.startswith("partial") or val.startswith("swift"):
                cmds.append(("BACKGROUND", (col, row), (col, row), HexColor("#fef3c7")))
    t.setStyle(TableStyle(cmds))
    story.append(t)

    story.append(PageBreak())

    # ── PAGE 7: QUICK REFERENCE ──
    story.append(Paragraph("Quick Reference Card", styles["h1"]))
    story.append(hr())

    story.append(Paragraph("gstack Slash Commands", styles["h2"]))
    qr_data = [
        ["Command", "When to Use"],
        ["/office-hours", "Starting a new feature or idea"],
        ["/plan-ceo-review", "Strategic review of any plan"],
        ["/plan-eng-review", "Architecture + test strategy review"],
        ["/plan-design-review", "Design completeness audit (0-10 ratings)"],
        ["/review", "Code review before merging"],
        ["/qa", "Browser-based QA + bug fixing"],
        ["/ship", "Create PR with tests + changelog"],
        ["/investigate", "Root-cause debugging"],
        ["/design-review", "Visual design audit of live site"],
        ["/retro", "Weekly engineering retrospective"],
        ["/careful", "Safety mode for production work"],
        ["/freeze", "Lock edits to one directory"],
    ]
    story.append(make_table(qr_data, col_widths=[W*0.28, W*0.72]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Swift Skills (Auto-Activate)", styles["h2"]))
    sw_data = [
        ["Skill", "Activates When", "Key References"],
        ["swiftui-pro", "Reading/writing SwiftUI code", "api.md, views.md, data.md,\ndesign.md, performance.md"],
        ["swift-testing-pro", "Writing or reviewing Swift tests", "core-rules.md, async-tests.md,\nmigrating-from-xctest.md"],
        ["swift-concurrency-pro", "Working with async/await code", "actors.md, hotspots.md,\ncancellation.md, bug-patterns.md"],
    ]
    story.append(make_table(sw_data, col_widths=[W*0.22, W*0.32, W*0.46]))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Installation Check", styles["h2"]))
    story.append(code("ls ~/.claude/skills/"))
    story.append(Paragraph("Should show: gstack, swiftui-pro, swift-testing-pro, swift-concurrency-pro", styles["body"]))
    story.append(Spacer(1, 16))

    story.append(hr())
    story.append(Paragraph("Generated for Amar Gandhi's Claude Code setup. March 2026.", styles["footer"]))
    story.append(Paragraph("Fork: github.com/amargandhi/gstack | Swift Skills: github.com/twostraws/Swift-Agent-Skills", styles["footer"]))

    doc.build(story)
    print(f"PDF written to: {OUTPUT}")

if __name__ == "__main__":
    build()
