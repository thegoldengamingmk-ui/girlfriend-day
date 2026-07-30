import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SOURCE_IMAGE_PATH = r"C:\Users\Mukesh\.gemini\antigravity-ide\brain\86e9c1ad-466d-422f-872e-b6f199589cac\media__1785427433996.jpg"
PUBLIC_DIR = r"c:\Users\Mukesh\Desktop\Cinematic Romantic Gift Website\public"

os.makedirs(PUBLIC_DIR, exist_ok=True)

# 1. Load source image
img = Image.open(SOURCE_IMAGE_PATH).convert("RGBA")

# Make white background transparent
datas = img.getdata()
new_data = []
for item in datas:
    if item[0] > 235 and item[1] > 235 and item[2] > 235:
        new_data.append((255, 255, 255, 0))
    else:
        new_data.append(item)

transparent_logo = Image.new("RGBA", img.size)
transparent_logo.putdata(new_data)
transparent_logo.save(os.path.join(PUBLIC_DIR, "logo.png"), "PNG")
img.convert("RGB").save(os.path.join(PUBLIC_DIR, "logo.jpg"), "JPEG", quality=95)

# 2. Generate Favicons
def create_favicon(size):
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    margin = max(1, int(size * 0.06))
    target_size = size - (margin * 2)
    bbox = transparent_logo.getbbox()
    cropped_logo = transparent_logo.crop(bbox) if bbox else transparent_logo
    w, h = cropped_logo.size
    ratio = min(target_size / w, target_size / h)
    new_w, new_h = max(1, int(w * ratio)), max(1, int(h * ratio))
    resized_logo = cropped_logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
    pos_x = (size - new_w) // 2
    pos_y = (size - new_h) // 2
    canvas.paste(resized_logo, (pos_x, pos_y), resized_logo)
    return canvas

sizes_map = {
    "favicon-16x16.png": 16,
    "favicon-32x32.png": 32,
    "favicon-48x48.png": 48,
    "apple-touch-icon.png": 180,
    "android-chrome-192x192.png": 192,
    "android-chrome-512x512.png": 512,
}

fav_images = []
for filename, size in sizes_map.items():
    fav_img = create_favicon(size)
    fav_img.save(os.path.join(PUBLIC_DIR, filename))
    if size in (16, 32, 48):
        fav_images.append(fav_img.convert("RGBA"))

ico_path = os.path.join(PUBLIC_DIR, "favicon.ico")
fav_images[1].save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

# 3. Generate Open Graph Image (1200 x 630 px)
og_width, og_height = 1200, 630
og_bg = Image.new("RGBA", (og_width, og_height), (0, 0, 0, 255))

draw_bg = ImageDraw.Draw(og_bg)
for y in range(og_height):
    t = y / og_height
    if t < 0.5:
        sub_t = t / 0.5
        r = int(24 + (60 - 24) * sub_t)
        g = int(2 + (10 - 2) * sub_t)
        b = int(45 + (55 - 45) * sub_t)
    else:
        sub_t = (t - 0.5) / 0.5
        r = int(60 + (15 - 60) * sub_t)
        g = int(10 + (2 - 10) * sub_t)
        b = int(55 + (28 - 55) * sub_t)
    draw_bg.line([(0, y), (og_width, y)], fill=(r, g, b, 255))

# Add ambient pink radial glow
glow_layer = Image.new("RGBA", (og_width, og_height), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow_layer)
glow_draw.ellipse([320, 40, 880, 560], fill=(232, 120, 154, 55))
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(90))
og_bg = Image.alpha_composite(og_bg, glow_layer)

# Composite logo
bbox = transparent_logo.getbbox()
cropped_logo = transparent_logo.crop(bbox) if bbox else transparent_logo
logo_w, logo_h = cropped_logo.size
target_logo_h = 240
ratio = target_logo_h / logo_h
target_logo_w = int(logo_w * ratio)

scaled_logo = cropped_logo.resize((target_logo_w, target_logo_h), Image.Resampling.LANCZOS)
logo_x = (og_width - target_logo_w) // 2
logo_y = 50
og_bg.paste(scaled_logo, (logo_x, logo_y), scaled_logo)

# Load high quality fonts from Windows Fonts folder
font_dir = r"C:\Windows\Fonts"
def get_font(name, size):
    path = os.path.join(font_dir, name)
    if os.path.exists(path):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

font_title = get_font("georgiab.ttf", 52)     # Georgia Bold
font_tagline = get_font("calibrib.ttf", 34)   # Calibri Bold
font_sub = get_font("calibri.ttf", 24)       # Calibri Regular

draw = ImageDraw.Draw(og_bg)

# Text 1: Brand Title "Our Memories"
title_text = "Our Memories"
bbox_title = draw.textbbox((0, 0), title_text, font=font_title)
tw = bbox_title[2] - bbox_title[0]
draw.text(((og_width - tw) // 2, 310), title_text, fill=(255, 242, 246, 255), font=font_title)

# Text 2: Tagline "Turn Your Memories Into a Beautiful Surprise"
tagline_text = "Turn Your Memories Into a Beautiful Surprise"
bbox_tagline = draw.textbbox((0, 0), tagline_text, font=font_tagline)
tgw = bbox_tagline[2] - bbox_tagline[0]
draw.text(((og_width - tgw) // 2, 390), tagline_text, fill=(255, 190, 210, 255), font=font_tagline)

# Text 3: Sub-description
sub_text = "Photos  •  Voice Notes  •  Romantic Music  •  Heartfelt Messages"
bbox_sub = draw.textbbox((0, 0), sub_text, font=font_sub)
sw = bbox_sub[2] - bbox_sub[0]
draw.text(((og_width - sw) // 2, 460), sub_text, fill=(240, 215, 230, 220), font=font_sub)

# Text 4: Domain pill at bottom
domain_text = "https://oursmemories.online"
bbox_dom = draw.textbbox((0, 0), domain_text, font=font_sub)
dw = bbox_dom[2] - bbox_dom[0]
pill_x = (og_width - dw) // 2 - 25
pill_y = 525
draw.rounded_rectangle([pill_x, pill_y, pill_x + dw + 50, pill_y + 46], radius=23, fill=(255, 255, 255, 28), outline=(255, 180, 210, 90), width=1)
draw.text(((og_width - dw) // 2, pill_y + 10), domain_text, fill=(255, 225, 238, 255), font=font_sub)

# Save og-image.jpg
final_og = og_bg.convert("RGB")
final_og.save(os.path.join(PUBLIC_DIR, "og-image.jpg"), "JPEG", quality=95)

print("Saved updated og-image.jpg and favicons successfully!")
