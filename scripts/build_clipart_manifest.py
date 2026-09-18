#!/usr/bin/env python3
"""Build manifest.json for the seed clip-art sheet: merges assets.json geometry
with human-readable names + categories (mapped row-major to the known sheet)."""
import json, os

OUT = "/app/web/public/cliparts"

# name, category  (row-major order matching the seed sheet, 81 assets)
NAMED = [
    ("Lion", "Animals"), ("Tiger", "Animals"), ("Wolf", "Animals"), ("Eagle", "Animals"),
    ("Komodo Dragon", "Animals"), ("Sea Turtle", "Animals"), ("Shark", "Animals"),
    ("Dolphin", "Animals"), ("Orca", "Animals"), ("Husky", "Animals"),
    ("Cat", "Animals"), ("Golden Retriever", "Animals"), ("Parrot", "Animals"),
    ("Kingfisher", "Animals"), ("Butterfly", "Animals"),
    ("Hibiscus", "Flowers & Plants"), ("Frangipani", "Flowers & Plants"),
    ("Sunflower", "Flowers & Plants"), ("Rose", "Flowers & Plants"), ("Monstera Leaf", "Flowers & Plants"),
    ("Mountain Forest", "Nature"), ("Beach Sunset", "Nature"), ("Ocean Wave", "Nature"),
    ("Palm Trees", "Nature"), ("Forest Sunset", "Nature"), ("Compass", "Symbols"),
    ("Snowy Mountains", "Nature"), ("Camping Tent", "Nature"), ("Campfire", "Nature"), ("Pine Tree", "Nature"),
    ("Motorcycle", "Transport"), ("Jeep", "Transport"), ("Camper Van", "Transport"),
    ("Airplane", "Transport"), ("Globe", "Symbols"),
    ("Surfboard", "Sports"), ("Skateboard", "Sports"), ("Bicycle", "Sports"),
    ("Soccer Ball", "Sports"), ("Basketball", "Sports"), ("Volleyball", "Sports"),
    ("Badminton", "Sports"), ("Dumbbell", "Sports"), ("Boxing Gloves", "Sports"),
    ("Game Controller", "Objects"),
    ("Chef & Utensils", "Food & Drink"), ("Coffee Cup", "Food & Drink"), ("Burger", "Food & Drink"),
    ("Pizza Slice", "Food & Drink"), ("Pizza Slice", "Food & Drink"), ("Ice Cream", "Food & Drink"),
    ("Camera", "Objects"), ("Headphones", "Objects"), ("Light Bulb", "Objects"), ("Crown", "Objects"),
    ("Heart", "Symbols"), ("Star", "Symbols"), ("Flame", "Symbols"), ("Lightning Bolt", "Symbols"),
    ("Smiley", "Symbols"), ("Yin Yang", "Symbols"), ("Peace Sign", "Symbols"), ("Recycle", "Symbols"),
    ("Wings", "Tattoo"), ("Compass Rose", "Symbols"), ("Mountains", "Nature"), ("Palm Tree", "Nature"),
    ("Sun", "Nature"), ("Crescent Moon", "Nature"),
    ("Barong Mask", "Culture"), ("Balinese Temple", "Culture"),
    ("Feather", "Tattoo"), ("Anchor", "Symbols"), ("Lotus", "Tattoo"), ("Celtic Knot", "Tattoo"),
    ("Tribal Wave", "Tattoo"), ("Hibiscus Tribal", "Tattoo"), ("Paw Print", "Symbols"),
    ("Shaka Hand", "Symbols"), ("Good Vibes", "Text"), ("Mountain Line", "Nature"),
]

assets = json.load(open(os.path.join(OUT, "assets.json")))
manifest = []
for i, a in enumerate(assets):
    name, cat = NAMED[i] if i < len(NAMED) else (f"Clipart {a['id'].split('-')[-1]}", "Uncategorized")
    manifest.append({
        "id": a["id"],
        "filename": a["filename"],
        "name": name,
        "category": cat,
        "tags": [name.lower(), cat.lower()],
        "url": a["url"],
        "thumb": a["thumb"],
        "width": a["width"],
        "height": a["height"],
        "aspectRatio": a["aspectRatio"],
    })

json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=2)
cats = sorted({m["category"] for m in manifest})
print(f"manifest.json written: {len(manifest)} assets, categories: {cats}")
