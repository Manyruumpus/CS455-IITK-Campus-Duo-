from pathlib import Path
from PIL import Image, ImageOps

folder = Path(__file__).resolve().parent
output = folder /  "stage2.pdf"
output.parent.mkdir(parents=True, exist_ok=True)

files = sorted(
    (
        path for path in folder.iterdir()
        if path.is_file()
        and path.suffix.lower() in {".png", ".jpg", ".jpeg"}
    ),
    key=lambda path: path.name.lower(),
)

if not files:
    raise SystemExit("No PNG or JPEG images found.")

pages = []

try:
    for path in files:
        with Image.open(path) as image:
            image = ImageOps.exif_transpose(image).convert("RGBA")

            # Put transparent areas on a white background.
            page = Image.new("RGB", image.size, "white")
            page.paste(image, mask=image.getchannel("A"))
            pages.append(page)

    pages[0].save(
        output,
        format="PDF",
        save_all=True,
        append_images=pages[1:],
        resolution=100,
    )

    print(f"Created PDF with {len(pages)} pages: {output}")

finally:
    for page in pages:
        page.close()