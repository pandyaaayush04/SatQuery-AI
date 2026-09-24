"""Conversational layer: small talk that reads the user's mood, plus the question classifiers the server uses to route a message.

Small talk is rule-based on purpose -- instant, offline, no GPU -- and varied (random pick per category) so it never feels
canned. Anything it doesn't recognise falls through to the VLM's plain-chat mode (see QwenVLM.chat), then to a guide message.
"""
import random
import re
from datetime import datetime

IMAGERY_WORDS = ("land cover", "landcover", "land use", "vegetation", "forest", "tree", "green", "crop", "farm", "water", "lake", "river", "flood",
                 "urban", "built", "building", "city", "construction", "sprawl", "deforest", "satellite", "imagery", "image", "from space", "from orbit",
                 "cloud", "describe", "analy", "how much", "percent", "%", "coverage", "look like", "looks like", "show me", "map", "change", "changed",
                 "growth", "grown", "shrunk", "expand", "dry", "drought", "burn", "fire", "snow", "ice", "glacier", "coast")
CHANGE_WORDS = ("change", "changed", "changing", "since", "compared", "over time", "last year", "year ago", "growth", "grown", "grew", "expand",
                "shrunk", "shrink", "deforest", "before and after", "difference", "evolv", "transform", "increase", "decrease")

SYSTEM_PROMPT = (
    "You are SatQuery AI, a friendly, witty assistant that answers questions about satellite imagery (Sentinel-1 radar, Sentinel-2 optical, "
    "change over time). Reply in at most three short sentences. Match the user's mood: warm when they are down, playful when they are upbeat, "
    "concise when they are curt. You cannot see any image in this chat turn, so never invent measurements or describe a specific place's "
    "pixels; if they want real numbers, invite them to name a place (e.g. 'land cover around Pune') or attach an image."
)

_GREET = r"(hi+|hello+|hey+|heya|hiya|yo|hola|namaste|sup|howdy|greetings|good (morning|afternoon|evening)|what'?s up|wassup)"
_PATTERNS = [
    ("mood_sad", r"\b(sad|depressed|down|lonely|upset|stressed|stress|tired|exhausted|bad day|anxious|worried|not (feeling )?(good|great|well|okay|ok)|feeling low|miserable|crying)\b"),
    ("mood_angry", r"\b(angry|annoyed|frustrated|furious|hate you|useless|stupid|dumb|bad bot|worst|terrible bot|you suck)\b"),
    ("mood_happy", r"\b(happy|excited|thrilled|awesome day|great day|good mood|amazing day|feeling (great|good|amazing)|so good|celebrat)\w*"),
    ("mood_bored", r"\b(bored|boring|nothing to do)\b"),
    ("thanks", r"\b(thanks|thank you|thx|tysm|ty|appreciate (it|that)|cheers)\b"),
    ("bye", r"\b(bye+|goodbye|see you|see ya|cya|good ?night|take care|gotta go|talk later|ttyl)\b"),
    ("how_are_you", r"\b(how are (you|u)|how r (you|u)|how'?s it going|how do you do|how'?s life|how have you been|you good|hows? (your|ur) day)\b"),
    ("identity", r"\b(who are you|what are you|your name|what'?s your name|introduce yourself|tell me about yourself|are you (a )?(bot|ai|human|robot|real))\b"),
    ("capabilities", r"^(help( me)?( please)?|i need help)$|\b(what can you do|how do(es)? (this|it) work|how to use|what do you do|capabilities|features|guide me|what is satquery|what'?s satquery|abilities)\b"),
    ("creator", r"\b(who (made|built|created|developed|trained) you|who'?s your (creator|developer|maker)|which (team|company))\b"),
    ("joke", r"\b(joke|make me laugh|funny|cheer me up|humou?r)\b"),
    ("fact", r"\b(fun fact|interesting fact|tell me something|did you know|surprise me|something cool|random fact)\b"),
    ("compliment", r"\b(you'?re|you are|u r|ur) (so |really |very )?(great|smart|awesome|cool|amazing|clever|good|the best|brilliant|nice|helpful)\b|\b(good bot|well done|nice work|great job|good job|love this|love it|impressive)\b"),
    ("love", r"\b(i love you|love you|marry me|be my friend)\b"),
    ("datetime", r"\b(what('?s| is) (the )?(time|date|day)|what time is it|what day is (it|today)|current (time|date))\b"),
    ("weather", r"\b(weather|temperature outside|will it rain|forecast)\b"),
    ("ack", r"^(ok+|okay|k|cool|nice|great|sure|fine|alright|hmm+|lol|haha+|ha|wow|oh|yes|yeah|yep|no|nope|nah)$"),
    ("greet", r"^" + _GREET + r"\b"),
]
_MOODS = {"mood_sad", "mood_angry", "mood_happy", "mood_bored"}

_R = {
    "greet": [
        "Hey there! I'm SatQuery AI, your eyes in orbit. Name a place or drop in a satellite image and let's see what the Earth is up to.",
        "Hello! Ready when you are: try 'land cover around Pune' or attach a Sentinel image.",
        "Hi! Fresh pixels are waiting up there. Where shall we look?",
        "Hey! Point me at any place on Earth and I'll pull real Sentinel-2 imagery of it.",
    ],
    "greet_excited": [
        "Hey hey! Love the energy! Give me a place and I'll take us on a tour from orbit.",
        "Hello!! Great to see you. Which corner of the planet shall we peek at?",
    ],
    "how_are_you": [
        "Doing great, orbiting at 786 km, metaphorically speaking. How are you? And where would you like to look today?",
        "Running smoothly and curious as ever. How about you? Got a place in mind?",
        "All systems nominal, and slightly excited about clear skies over somewhere. You?",
    ],
    "thanks": [
        "Anytime! Happy to keep scanning.",
        "You're welcome! Want to compare another place or date?",
        "My pleasure. Got another area you're curious about?",
        "Glad it helped! Ask away whenever.",
    ],
    "bye": [
        "See you! The satellites will keep watching in the meantime.",
        "Bye for now! Come back with more places to explore.",
        "Take care! I'll be here, admiring Earth's curves.",
    ],
    "identity": [
        "I'm SatQuery AI: an assistant that reads satellite imagery (optical, radar, before/after) and cross-checks its own answers against the sensor data, and tells you plainly when it can't be sure.",
        "SatQuery AI here. I answer questions about satellite images, either ones you upload or live Sentinel-2 imagery of any place you name, and I show my evidence.",
    ],
    "capabilities": [
        "Here's what I can do:\n- **Name a place** ('land cover around Kraków', 'has Dubai grown since last year?') and I'll fetch real Sentinel-2 imagery.\n- **Attach an image** (1 = single, 2 = before/after or optical + SAR) and ask about water, vegetation, built-up areas or what changed.\n- **Chat**, ask me about places, or ask for a fun fact.\nI verify answers against band indices and I'll say so when I can't tell.",
    ],
    "creator": [
        "I was built for Smart India Hackathon 2026, problem statement 26167, on top of a Qwen3-VL model fine-tuned on Sentinel-1/2 BigEarthNet data, plus a physics checker so I can verify or refuse instead of bluffing.",
    ],
    "joke": [
        "Why did the satellite go to therapy? Too many unresolved issues with its orbit.",
        "I asked the satellite for feedback. It said I have great resolution but need to work on my swath.",
        "What do you call a satellite that tells jokes? A stand-up in low Earth orbit.",
        "Clouds and I have a complicated relationship: they keep photobombing my Sentinel-2 shots.",
    ],
    "fact": [
        "Sentinel-1 radar sees through clouds and darkness, so it can spot floods at night in monsoon weather when optical satellites see only white.",
        "Healthy plants glow in near-infrared. That's why the NDVI vegetation index works: leaves reflect NIR strongly and absorb red.",
        "Sentinel-2 revisits the same spot about every 5 days and its pixels are 10 metres wide, roughly a bus and a half.",
        "Water is nearly black in near-infrared, which is why lakes and rivers pop out so clearly in satellite indices like NDWI.",
        "The Great Wall of China isn't really visible from orbit with the naked eye, but city lights and airport runways are hard to miss.",
    ],
    "compliment": [
        "Aw, thanks! I'll try to earn it. What should we look at next?",
        "You're making my solar panels blush. What's next?",
        "Thank you! Give me a place and I'll show off a bit more.",
    ],
    "love": [
        "That's sweet! I'm just pixels and physics, but I do love a clear-sky scene. Where to next?",
    ],
    "weather": [
        "I don't do live weather forecasts, but I can look at what's on the ground: cloud cover in recent imagery, water, greenery, built-up areas. Name a place!",
    ],
    "ack": ["Got it!", "Alright. Anything else you'd like to look at?", "Sure thing.", "Okay! Name a place whenever you're ready."],
    "mood_sad": [
        "I'm sorry you're feeling that way. Sometimes a wider view helps: want to zoom out and look at somewhere calm, like a forest or a coastline, from orbit?",
        "That sounds rough, and I'm glad you told me. If it helps, I can show you somewhere peaceful from space. Any place come to mind?",
        "Take a breath, you've got this. Want a small distraction? Name any place and I'll show you what it looks like from up here.",
    ],
    "mood_angry": [
        "Sorry about that, I'll do better. Tell me what went wrong or name a place to analyse, and I'll give it a proper go.",
        "Fair enough, frustration noted. Give me a specific place or image and I'll show my evidence so you can judge for yourself.",
    ],
    "mood_happy": [
        "Love that energy! Let's make it even better: name a place and we'll go explore it from orbit.",
        "That's great to hear! Want to celebrate with a satellite tour? Pick any place on Earth.",
    ],
    "mood_bored": [
        "Boredom cure incoming: name any place on Earth and I'll show you what it looks like from space, or ask for a fun fact.",
        "Let's fix that. Try 'has Dubai grown in the last year?' or 'land cover around the Amazon', or ask me for a joke.",
    ],
}


def _norm(text):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s'%]", " ", text.lower())).strip()


def _tone_excited(raw):
    return "!" in raw or bool(re.search(r"(.)\1{2,}", raw)) or (raw.isupper() and len(raw) > 2)


def _hour_greeting():
    h = datetime.now().hour
    return "Good morning" if 5 <= h < 12 else "Good afternoon" if 12 <= h < 17 else "Good evening" if 17 <= h < 22 else "Hello, night owl"


def smalltalk(text):
    """Reply string if `text` is small talk (greeting, thanks, mood, identity, jokes...), else None. Long messages that
    merely start with 'hi' are not small talk unless they also carry a mood word, so real questions still go to the pipeline."""
    n = _norm(text)
    if not n:
        return None
    words = n.split()
    hits = [name for name, pat in _PATTERNS if re.search(pat, n)]
    if not hits:
        return None
    mood = next((h for h in hits if h in _MOODS), None)
    core = [h for h in hits if h not in _MOODS]
    if not mood and (len(words) > 14 or (core[0] == "greet" and len(words) > 4) or (len(words) > 8 and core[0] in ("capabilities", "datetime", "weather"))):
        return None  # a long message that merely opens with "hi" or contains "thanks" is a real question
    excited = _tone_excited(text)
    opener = ""
    if "greet" in hits and mood:
        opener = _hour_greeting() + "! "
    if mood:
        return opener + random.choice(_R[mood])
    kind = core[0]
    if kind == "greet":
        return random.choice(_R["greet_excited"] if excited and random.random() < 0.6 else _R["greet"])
    if kind == "datetime":
        now = datetime.now()
        return f"It's {now:%A, %d %B %Y}, {now:%H:%M} on my server clock. Satellite passes not included."
    return random.choice(_R[kind])


SESSION_HINTS = ("this", "these", "here", "it ", "color", "colour", "visible", "pattern", "shape", "object", "anything", "which", "where", "how many", "count",
                 "biggest", "largest", "dominant", "main", "locate", "point out", "highlight", "box", "detect", "identify")


def refers_to_session(text):
    q = text.lower()
    return is_imagery_question(q) or any(w in q for w in SESSION_HINTS)


def is_imagery_question(text):
    q = text.lower()
    return any(w in q for w in IMAGERY_WORDS)


def is_change_question(text):
    q = text.lower()
    return any(w in q for w in CHANGE_WORDS)


GUIDE = ("I can chat, but my real talent is satellite imagery. Try naming a place ('land cover around Pune', 'has Dubai grown since last year?') "
         "or attach a Sentinel image and ask about water, vegetation, built-up areas or change.")
