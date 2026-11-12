# The studio: how it works

This is the working description of the studio (`studio.html`). It says what a person can do at
each moment, what the studio refuses, and how the parts fit. Keep it current when behaviour changes.

Run it: `uv run server/ember.py` from this folder, then open <http://127.0.0.1:4180/studio.html>.
After a change to `server/ember.py` the server must be stopped and started again. Changes to
`flow.js`, `studio.js` and the css need only a browser reload.

## The screen

| Part | What it is |
|---|---|
| The board (canvas) | The whole studio. Steps and files are nodes; whatever is wired into **Final video**, in order, is the video. |
| The rail (left) | **Media** (your files) and **Shop** (TikTok Shop videos, with search and Trending / Most viewed). Step 1 is chosen here. |
| The message field (bottom centre) | The only place to type to Ember. Ember's face beside it shows or hides the chat session. |
| The chat session (left, hidden until you talk) | The conversation with Ember: replies, steps, approval cards. |
| The step panel (right) | Opens for steps 2 to 6 while that step is being worked on. Step 1 has no panel. |

Nothing opens by itself when the page loads. The step that is waiting says "Start here" and pulses.

## The six steps

| # | Step | How it is answered |
|---|---|---|
| 1 | The subject: what the video is about | A Shop video (rail, Shop), one of your files (rail, Media), or **Chat about it** and type it |
| 2 | Who is on camera | Your avatar, another photo, a picture made by our models, no one, or **Chat about it** and describe them |
| 3 | What to make | The kind of video and its length. The price follows the length |
| 4 | The script | Written from the product facts. Read it, change it, press **Looks good** |
| 5 | The voice | The presenter speaks, a library voice, or your own recording. Skipped when no one is on camera |
| 6 | Film it | Shows the price. Nothing renders until the button is pressed |

The filmed clip appears to the right of Film it and is wired into Final video. New things always
land to the right; Final video stays last.

## Rules the board enforces

Order is subject, on camera, what to make, script, voice, film. Subject and on camera may come in
either order; both come before "What to make".

- **What may come next.** The "What comes next?" menu greys every step that cannot follow and says
  why ("Already set: …", "Needs a subject first.").
- **Wires.** Refused with a reason: a step into a file, a wire going backwards, a second subject,
  person or voice into a chain that has one, a file into a step that is already answered, a loop.
- **Files answer steps.** A picture or clip wired into The subject is the subject; a picture into
  Who is on camera is the person; a sound into The voice is the voice. Unwiring empties the step.
- **Guided mode (on by default).** A dropped file goes to the step that is waiting, or is stopped
  with a message that says where it belongs. No loose nodes appear while a step is waiting.
- **A dropped picture is not guessed.** With Guided off, a menu asks whether it is the person or
  the product.
- **Shop clicks are decided by the board.** A click on a Shop video fills step 1 if it is empty.
  If step 1 is already answered the studio says so. It is never sent to Ember as a message.
- **While a clip is filming.** The steps that feed it are read-only, they cannot be deleted or
  rewired, Start over is refused, and a new Shop pick is refused. Stop is in Film it.
- **While Ember is working.** Board steps that call the server wait and say so.
- **Reloading mid-render is safe.** The render keeps running on the server. The Film it step keeps
  waiting, the page looks for the clip every few seconds, and wires it in when it arrives. After
  forty minutes with no clip it says the render did not report back.
- **Start over** wipes the board and takes the clips out of the video. Files stay in Media. It asks
  once when the video has clips.
- **Deleting a file** from Media asks once. A step that used a deleted file opens again.
- Drag on the empty board selects several nodes (move together, Backspace removes, Escape lets go,
  Shift-click adds). Space and drag, the middle button, or two-finger scroll moves the board.
  **Fit** tidies the layout, then fits it in view.

## Chat and Ember

- Typing is one more way to answer the step you are on. With **Chat about it** active, a tag above
  the field says which step is being answered; the text fills that step and the next step opens.
  No model turn runs and nothing is rendered.
- In normal chat Ember works through tools (`server/ember.py`, `TOOLS`). The ones that shape the
  flow:
  - `plan_video` lays a video out on the board as steps, filled in. With `creator: "ask"` it sets
    only step 1 and leaves the rest to the person. Ember does not render product videos from chat.
  - `find_hooks` listens to the first seconds of the most viewed Shop videos that really sell the
    product and returns how they open. Hooks and script ideas must come from this, not be invented.
  - `generate_clip` is only for "render it right now" or an extra shot in a video that already has
    its steps. It always shows a priced approval card first.
- With no product named, Ember asks "choose the product, or should I pick?" with two buttons.
- A reply from Ember says which product it chose and why, and which picture is on camera.
- Ember does not speak first while a step is open or before the video has a clip.
- An approval card that outlived its turn (it waits ten minutes) stays usable: its button pays for
  that one render.

## Hard rules (from AGENTS.md)

- All rendering runs on our own GPU through the model server. No GPU job starts without a press on
  a priced button or an approval card.
- A selling video from another creator is for structure only. Its face, voice and words are never
  reused, and it cannot be put into Final video.
- Every export carries the AI-generated label in the file metadata (`comment`, `description`).
- An AI presenter states product facts and never claims to have used the product.
- No invented numbers. Views and sales are shown only when the person asks for numbers.
- Users never reach the GPU or see machine addresses; errors shown in the browser are plain.

## Where things live

| File | Role |
|---|---|
| `flow.js`, `flow.css` | The board: nodes, wires, rules (`may`, `wireRule`), guided drops (`offer`), locks (`filming`), tidy, selection |
| `studio.js`, `studio.css` | The shell: rail, message field and chat, menus, projects, uploads, the bridge `window.EmberStudio` |
| `easy.js`, `easy.css` | The step strip above the board and first-run simplifications |
| `server/ember.py` | Server: projects and files, Ember's loop and tools, board steps (`flow_script`, `flow_film`, `flow_picture`, `flow_voice`), export |
| `server/data/` | Per person, per project files. Not committed |
| `server/.env` | Model key. Not committed, never printed |

The board's graph is saved in the browser (`localStorage`, one per person and project). The
project (files, the cut, captions) is saved on the server.

## Testing without spending

- A second server for tests: `EMBER_PORT=4181 uv run server/ember.py`. Send chat or actions to it
  with the headers `X-Ember-User` and `X-Ember-Project`.
- Never press Film to test. Stop at the priced button, or stub the `flow_film` request in the page.
- Checked on 2026-11-12 on a test server: script writing for a Shop pick that is no longer in the
  results, an unknown action (400), stop with nothing running, a stale approval (404), export (file
  served, label in metadata), captions.

## Not built yet

- Lip-synced voices other than the video model's own; library and own voices are voiceovers.
- Supabase accounts and storage (`supabase/` holds the data model only).
- The phone layout of the board works but is not tuned.
