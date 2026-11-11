// The three n8n workflows, as node graphs. Generated from workflows/*.json in
// github.com/smammadov1994/n8n-video-pipelines (names, types, positions, connections).
window.EMBER_PIPELINES = [
 {
  "id": "swap-machine",
  "name": "Swap machine",
  "nodes": [
   {
    "name": "Every 30 minutes",
    "type": "scheduleTrigger",
    "x": 0,
    "y": 0
   },
   {
    "name": "Run once now",
    "type": "manualTrigger",
    "x": 0,
    "y": 200
   },
   {
    "name": "Settings",
    "type": "set",
    "x": 220,
    "y": 100
   },
   {
    "name": "Pick and prepare clips",
    "type": "executeCommand",
    "x": 440,
    "y": 100,
    "sub": "swap_job.py"
   },
   {
    "name": "Send to swap machine",
    "type": "executeCommand",
    "x": 660,
    "y": 100,
    "sub": "swap_job.py"
   },
   {
    "name": "Collect finished swaps",
    "type": "executeCommand",
    "x": 880,
    "y": 100,
    "sub": "swap_job.py"
   },
   {
    "name": "Read result",
    "type": "code",
    "x": 1100,
    "y": 100
   },
   {
    "name": "Post to TikTok",
    "type": "noOp",
    "x": 1320,
    "y": 100,
    "sub": "not built yet",
    "ghost": true
   }
  ],
  "edges": [
   [
    "Every 30 minutes",
    "Settings",
    0
   ],
   [
    "Run once now",
    "Settings",
    0
   ],
   [
    "Settings",
    "Pick and prepare clips",
    0
   ],
   [
    "Pick and prepare clips",
    "Send to swap machine",
    0
   ],
   [
    "Send to swap machine",
    "Collect finished swaps",
    0
   ],
   [
    "Collect finished swaps",
    "Read result",
    0
   ],
   [
    "Read result",
    "Post to TikTok",
    0
   ]
  ],
  "tag": "Product swap",
  "blurb": "Takes a product video that is already selling, keeps the room, the product and the movements, and puts your creator and one consistent voice in it.",
  "steps": [
   "Screen each candidate clip: one person, face visible and talking, product in hand",
   "Transcribe it and speak every line in your creator's voice",
   "Swap on an RTX 5090 and collect the finished video"
  ],
  "status": "Posting to TikTok is not built yet. Finished clips wait in a folder.",
  "video": {
   "src": "media/swap_bottle_buddy.mp4",
   "poster": "media/swap_bottle_buddy.jpg",
   "aspect": "9 / 8",
   "label": "RIGHT HALF AI-GENERATED"
  },
  "caption": "Original creator left, our presenter right. Creators shown agreed to this feature."
 },
 {
  "id": "episode-machine",
  "name": "Episode machine",
  "nodes": [
   {
    "name": "Every 10 minutes",
    "type": "scheduleTrigger",
    "x": 0,
    "y": 0
   },
   {
    "name": "Run once now",
    "type": "manualTrigger",
    "x": 0,
    "y": 200
   },
   {
    "name": "Topics",
    "type": "code",
    "x": 220,
    "y": 100
   },
   {
    "name": "Pick next topic",
    "type": "executeCommand",
    "x": 440,
    "y": 100,
    "sub": "episode_job.py"
   },
   {
    "name": "Read pick",
    "type": "code",
    "x": 660,
    "y": 100
   },
   {
    "name": "Go?",
    "type": "if",
    "x": 880,
    "y": 100
   },
   {
    "name": "Nothing to do",
    "type": "noOp",
    "x": 1100,
    "y": 260
   },
   {
    "name": "Plan episode",
    "type": "executeCommand",
    "x": 1100,
    "y": 0,
    "sub": "episode_job.py"
   },
   {
    "name": "Read plan",
    "type": "code",
    "x": 1320,
    "y": 0
   },
   {
    "name": "Planned?",
    "type": "if",
    "x": 1540,
    "y": 0
   },
   {
    "name": "Shoot episode",
    "type": "executeCommand",
    "x": 1760,
    "y": -100,
    "sub": "episode_job.py"
   },
   {
    "name": "Finish",
    "type": "executeCommand",
    "x": 1980,
    "y": 0,
    "sub": "episode_job.py"
   },
   {
    "name": "Read result",
    "type": "code",
    "x": 2200,
    "y": 0
   },
   {
    "name": "Clean?",
    "type": "if",
    "x": 2420,
    "y": 0
   },
   {
    "name": "Upload to YouTube",
    "type": "executeCommand",
    "x": 2640,
    "y": -100,
    "sub": "episode_job.py"
   },
   {
    "name": "Needs a look",
    "type": "noOp",
    "x": 2640,
    "y": 120
   },
   {
    "name": "Read upload",
    "type": "code",
    "x": 2860,
    "y": -100
   }
  ],
  "edges": [
   [
    "Every 10 minutes",
    "Topics",
    0
   ],
   [
    "Run once now",
    "Topics",
    0
   ],
   [
    "Topics",
    "Pick next topic",
    0
   ],
   [
    "Pick next topic",
    "Read pick",
    0
   ],
   [
    "Read pick",
    "Go?",
    0
   ],
   [
    "Go?",
    "Plan episode",
    0
   ],
   [
    "Go?",
    "Nothing to do",
    1
   ],
   [
    "Plan episode",
    "Read plan",
    0
   ],
   [
    "Read plan",
    "Planned?",
    0
   ],
   [
    "Planned?",
    "Shoot episode",
    0
   ],
   [
    "Planned?",
    "Finish",
    1
   ],
   [
    "Shoot episode",
    "Finish",
    0
   ],
   [
    "Finish",
    "Read result",
    0
   ],
   [
    "Read result",
    "Clean?",
    0
   ],
   [
    "Clean?",
    "Upload to YouTube",
    0
   ],
   [
    "Clean?",
    "Needs a look",
    1
   ],
   [
    "Upload to YouTube",
    "Read upload",
    0
   ],
   [
    "Nothing to do",
    "Upload to YouTube",
    0
   ],
   [
    "Needs a look",
    "Upload to YouTube",
    0
   ]
  ],
  "tag": "Educational presenter",
  "blurb": "An AI presenter explains one science question per episode, as a wide video and a vertical Short.",
  "steps": [
   "Write the script, check every fact, rewrite lines that read badly out loud",
   "Voice first, then a clip per take generated around that audio",
   "Check words, face and big mistakes, with up to four tries per take",
   "Clean episodes go to YouTube. Flagged ones wait for a person"
  ],
  "status": "Publishing is spaced to one episode every 3 hours.",
  "video": {
   "src": "media/edu_autumn_short.mp4",
   "poster": "media/edu_autumn_short.jpg",
   "aspect": "9 / 16",
   "label": "AI-GENERATED"
  },
  "caption": "Where autumn colors come from, vertical Short."
 },
 {
  "id": "cartoon-machine",
  "name": "Cartoon machine",
  "nodes": [
   {
    "name": "Run once now",
    "type": "manualTrigger",
    "x": 0,
    "y": 100
   },
   {
    "name": "Episode",
    "type": "set",
    "x": 220,
    "y": 100
   },
   {
    "name": "Make start pictures",
    "type": "executeCommand",
    "x": 440,
    "y": 100,
    "sub": "cartoon_job.py"
   },
   {
    "name": "Record Mango's voice",
    "type": "executeCommand",
    "x": 660,
    "y": 100,
    "sub": "cartoon_job.py"
   },
   {
    "name": "Shoot the scenes",
    "type": "executeCommand",
    "x": 880,
    "y": 100,
    "sub": "cartoon_job.py"
   },
   {
    "name": "Join and make Short",
    "type": "executeCommand",
    "x": 1100,
    "y": 100,
    "sub": "cartoon_job.py"
   },
   {
    "name": "Read result",
    "type": "code",
    "x": 1320,
    "y": 100
   }
  ],
  "edges": [
   [
    "Run once now",
    "Episode",
    0
   ],
   [
    "Episode",
    "Make start pictures",
    0
   ],
   [
    "Make start pictures",
    "Record Mango's voice",
    0
   ],
   [
    "Record Mango's voice",
    "Shoot the scenes",
    0
   ],
   [
    "Shoot the scenes",
    "Join and make Short",
    0
   ],
   [
    "Join and make Short",
    "Read result",
    0
   ]
  ],
  "tag": "Kids cartoon",
  "blurb": "Mango, a round orange cat, teaches children to cook one simple recipe per episode.",
  "steps": [
   "One start picture per scene, each made from the one before",
   "Record Mango's voice",
   "Shoot the scenes, up to four tries each",
   "Join them and cut a vertical Short"
  ],
  "status": "The workflow imports cleanly but has not yet produced an episode end to end without a person.",
  "video": {
   "src": "media/mango_omelet.mp4",
   "poster": "media/mango_omelet.jpg",
   "aspect": "16 / 9",
   "label": "AI-GENERATED"
  },
  "caption": "Mango makes an omelet, five shots."
 }
];
