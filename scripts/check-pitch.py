"""Check the exported deck and build its contact sheet. Optional tooling only."""
from pathlib import Path

import pymupdf as fitz
from PIL import Image
import zxingcpp


root = Path(__file__).resolve().parents[1]
pdf = root / "docs/pitch/first-month-pitch.pdf"
document = fitz.open(pdf)
assert len(document) == 10, "The submission requires no more than ten slides."

fonts = set()
links = []
thumbnails = []
for number, page in enumerate(document, start=1):
    assert abs(page.rect.width / page.rect.height - 16 / 9) < 0.001
    content = page.get_text()
    assert any("\u0400" <= char <= "\u04ff" for char in content), f"Missing Cyrillic text on slide {number}"
    assert "\ufffd" not in content, f"Invalid text on slide {number}"
    for font in page.get_fonts():
        if font[2] == "Type3":
            # Chromium can embed a symbol as PDF glyph drawing procedures.
            assert document.xref_get_key(font[0], "CharProcs")[0] == "dict"
        else:
            assert document.extract_font(font[0])[3], f"Font is not embedded: {font[3]}"
        fonts.add(font[3] or f"Type3 glyphs ({font[4]})")
    links.extend(link["uri"] for link in page.get_links() if link.get("uri"))
    pixmap = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5), alpha=False)
    thumbnails.append(Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples))

for target in [
    "https://first-month-six.vercel.app",
    "https://github.com/amurapan/first-month",
    "https://www.bls.gov/news.release/archives/famee_04232026.htm",
    "https://www.ynab.com/features/subscription-sharing",
    "https://apps.apple.com/us/app/duodime-ai-couples-finance/id6757925533",
]:
    assert target.rstrip("/") in {link.rstrip("/") for link in links}, f"Missing PDF link: {target}"

last_page = document[-1].get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
last_image = Image.frombytes("RGB", [last_page.width, last_page.height], last_page.samples)
decoded = zxingcpp.read_barcodes(last_image)
assert any(code.text == "https://first-month-six.vercel.app" for code in decoded), "Demo QR code cannot be decoded from the PDF."

width, height = thumbnails[0].size
sheet = Image.new("RGB", (width * 2 + 60, height * 5 + 120), (226, 220, 210))
for index, thumbnail in enumerate(thumbnails):
    sheet.paste(thumbnail, (20 + (index % 2) * (width + 20), 20 + (index // 2) * (height + 20)))
sheet.save(root / "docs/pitch/preview.png", optimize=True)

print(f"Verified 10 slides, 16:9 pages, selectable Cyrillic text, {len(fonts)} embedded font subsets, and {len(links)} link annotations.")
print("Decoded the demo QR directly from the final PDF. Updated docs/pitch/preview.png.")
print(f"PDF: {pdf.stat().st_size:,} bytes")
