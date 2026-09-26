// Wording pools. Kept in one place so tone stays consistent and more lines can be added without touching any component.

// ---- Shown while the model works. One is picked at random every few seconds, never the same one twice in a row.
export const WAITING: Record<string, string[]> = {
  "In orbit": [
    "Asking Sentinel-2 to look this way…",
    "Waiting for a satellite to come around…",
    "Warming up the view from 786 km up…",
    "Syncing with a spacecraft moving at 7 km every second…",
    "Politely tapping the satellite on the shoulder…",
    "Aligning the antennas…",
    "Checking the orbit is where we left it…",
    "Counting how many satellites are overhead…",
  ],
  "Reading the pixels": [
    "Counting pixels, all of them…",
    "Squinting at the shoreline…",
    "Measuring greenery, one leaf at a time…",
    "Separating water from shadows…",
    "Comparing bands like a very fussy librarian…",
    "Asking the near-infrared band what it thinks…",
    "Checking that the water really is water…",
    "Looking for buildings hiding behind trees…",
  ],
  "Sensors and science": [
    "Fun fact: radar can see through clouds and in the dark.",
    "Fun fact: healthy leaves shine in near-infrared, which is how we spot vegetation.",
    "Fun fact: water soaks up near-infrared light, so it looks dark to the sensor.",
    "Fun fact: each Sentinel-2 pixel covers about 10 metres on the ground.",
    "Fun fact: Sentinel-2 revisits the same place roughly every five days.",
    "Fun fact: cities look bright to radar because buildings bounce the signal straight back.",
    "Fun fact: satellites do not take photos the way phones do, they measure light in separate bands.",
    "Fun fact: the same place can look completely different between the wet and dry season.",
  ],
  "Around the world": [
    "About seven-tenths of Earth is water, so we're checking the rest.",
    "Somewhere a river is quietly changing course…",
    "Taking a tour of the Himalayas at 10 metres per pixel…",
    "Following the coastline, no passport required…",
    "Peeking at farmland from 786 km up…",
    "Wondering whether that green patch is a park or a field…",
    "Mapping the monsoon, one cloud at a time…",
    "Flying over the Deccan without leaving your chair…",
  ],
  "Keeping it light": [
    "Thinking very hard, in several wavelengths…",
    "Consulting the evidence, not my imagination…",
    "Double-checking so I don't embarrass either of us…",
    "Good questions take a moment. This is one of them.",
    "Brewing an answer with a pinch of physics…",
    "Making sure the numbers add up before I say them…",
    "Sharpening the pencils…",
    "One moment, the satellites are being dramatic…",
  ],
  "Little bits of Earth": [
    "The Sahara is about as big as the United States.",
    "Some rivers flow into the sea, some just disappear into the desert…",
    "Forests breathe out cloud-making moisture. We're checking yours.",
    "Salt lakes look pink from space when the algae are happy.",
    "Glaciers are slow, but from orbit you can watch them think.",
    "City lights are only for night passes, this one is daylight.",
  ],
}

const WAITING_ALL = Object.values(WAITING).flat()

/** Pick a waiting line that isn't the one currently showing. */
export function nextWaiting(current?: string): string {
  let next = current
  while (next === current) next = WAITING_ALL[Math.floor(Math.random() * WAITING_ALL.length)]
  return next as string
}

/** Extra reassurance when a reply is taking a while (seconds waited so far). */
export function slowHint(seconds: number): string | null {
  if (seconds >= 60) return "Still working. The very first question after the server restarts can take a few minutes while the model wakes up."
  if (seconds >= 20) return "Thanks for your patience. Larger scenes and the first question of the day take a little longer."
  return null
}

// ---- When the honest answer is "I can't tell". Polite and varied, never alarming.
export const DIPLOMATIC_TITLES = [
  "I'd rather not guess on this one.",
  "The evidence isn't strong enough for me to commit.",
  "I can't stand behind an answer to that just yet.",
  "With respect, the data doesn't settle this.",
  "That's a fair question, but I can't answer it responsibly from this.",
  "I'd rather be honest than sound certain.",
  "This one sits just beyond what the sensors can confirm.",
  "I'd be speculating, and you deserve better than that.",
  "The signal is too faint for a confident answer.",
  "I'd need a little more to go on to answer that well.",
  "Let me be candid: I can't verify this from what I was given.",
  "I'd hold off on a firm answer here.",
  "The picture is inconclusive, and I'd rather say so.",
  "Thank you for asking. I can't answer this reliably yet.",
  "It would be unwise to give a firm answer on this evidence.",
  "The sensors are politely silent on this one.",
  "I can't give you a dependable answer from this scene alone.",
  "This is a case where a careful 'not sure' beats a confident guess.",
]

export const DIPLOMATIC_TRY = [
  "Adding the other sensor (optical or radar) for the same place often settles it.",
  "A clearer, cloud-free image of the same place would help.",
  "You could ask about water, vegetation or built-up areas, which I can check directly.",
  "If you have an image from another date, I can compare the two.",
  "Try naming a place and I'll fetch fresh imagery to look at.",
  "A slightly different wording of the question might also help.",
]

/** Stable pick from a list for a given message id, so the wording doesn't change every time the chat re-renders. */
export function pickStable<T>(list: T[], key: string): T {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0
  return list[Math.abs(h) % list.length]
}
