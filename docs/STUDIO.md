# The studio: how it works

This is the working description of the studio (`studio.html`). It says what a person can do at
each moment, what the studio refuses, and how the parts fit. Keep it current when behaviour changes.

Run it: `uv run server/ember.py` from this folder, then open <http://127.0.0.1:4180/studio.html>.
After a change to `server/ember.py` the server must be stopped and started again. Changes to
`flow.js`, `studio.js` and the css need only a browser reload.

## The screen

| Part | What it is |
|---|---|
| The board (canvas) | The whole right side, and the whole studio. Steps and files are nodes; whatever is wired into **Final video**, in order, is the video. |
| The rail (left) | **Media** (your files) and **Shop** (TikTok Shop videos or products, with search and an order switch). Step 1 is chosen here. Pulled wider, each card shows the product's numbers. |
| The message field (bottom centre) | The only place to type to Ember. Ember's face beside it shows or hides the chat session. |
| The chat session (left, hidden until you talk) | The conversation with Ember: replies, steps, approval cards. |
| The step panel (in the rail) | Steps 2 to 6, a file's details and Final video open in the left rail, over Media and Shop, and the rail widens. Close it (× or Esc) to get Media and Shop back. Step 1 uses Media and Shop themselves. On a phone it is a sheet at the bottom. |

Nothing opens by itself when the page loads. The step that is waiting says "Start here" and pulses.

## The six steps

| # | Step | How it is answered |
|---|---|---|
| 1 | The subject: what the video is about | A Shop video (rail, Shop), one of your files (rail, Media), or **Chat about it** and type it |
| 2 | Who is on camera | Your avatar, another photo, a picture made by our models, no one, or **Chat about it** and describe them |
| 3 | What to make | The kind of video, its look (phone footage, or a cinematic commercial) and its length. The price follows the length |
| 4 | The script | Written from the product facts. Read it, change it, press **Looks good** |
| 5 | The voice | The presenter speaks, a library voice, or your own recording. Skipped when no one is on camera |
| 6 | Film it | Shows the price. Nothing renders until the button is pressed |

The look changes both the brief and the render. Phone footage is plain and handheld, the way a
creator films it. A cinematic commercial is briefed like an advert (an arc, a named lens, one
designed camera move, shaped light, shallow focus, designed sound) and renders at the highest
quality, which takes longer and costs the same. With no one on camera the look starts as cinematic;
with a presenter it starts as phone footage.

**Commercial** is the one kind of video made of several shots. You pick 2, 3 or 4 shots; the script
step writes them as one story (one box a shot, each editable); Film it renders them one after
another, each about 5 seconds, cinematic, nobody speaking, and wires every shot into Final video in
order. The price is the price of one shot times the number of shots, shown before anything renders.
If a shot fails, the ones already filmed stay in the video and the button films only the shots left,
at the price of those shots. A commercial has not been rendered for real yet (12 November 2026): the
loop, the price and the wiring were checked with stand-in clips.

The filmed clip appears to the right of Film it and is wired into Final video. New things always
land to the right; Final video stays last.

**One take per Film it step.** Filming again from the same step (Film another take, or after the
script changed) replaces what that step filmed before: when the new clip lands, the old one leaves
Final video and the board, and the new one takes its place in the order. The old clip stays in
Media, and the cut before the change is kept in Versions. The panel says this before the button is
pressed. In a commercial, only the shots whose words changed are filmed again, from the first
changed shot on, at the price of those shots. Checked with stand-in clips, not with a real render.

**A voiceover belongs to its clip.** A library voice or your own recording laid over a clip moves
with that clip when the order changes, and leaves the video when the clip does.

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
- **Clearing the avatar** takes two clicks. Another creator's selling video has no "add to the
  final video" button and cannot be wired in; export also refuses it.
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
- Every message carries the board's steps (what is chosen, what is waiting, whether a render is
  running). Ember reads them, does not overwrite a choice it was not asked to change, and starts
  nothing that films while a render is running.
- Ember does only what was asked. It never starts a video, imports one or films because of
  something it noticed; it offers that as a button instead.
- A reply from Ember says which product it chose and why, and which picture is on camera.
- Ember does not speak first while a step is open or before the video has a clip.
- An approval card that outlived its turn (it waits ten minutes) stays usable: its button pays for
  that one render.

## Shop data (Kaiyros Discover)

The studio reads one endpoint, `GET /v1/creator-discovery/videos`, through the model server's
`kaiyros_discover`. `shop_row()` in `server/ember.py` keeps, for every video:

| About | Fields |
|---|---|
| The video | views, views gained in the last day, likes, saves, shares, comments, length, date posted, hashtags |
| The product | price and the price before a discount, units sold in 7 days and in total, estimated 7-day revenue, how sales moved against the week before, rating and number of reviews, seller, category |
| The market | how many videos and creators already sell it, stock status, the affiliate commission |

Where it is used:
- The script writer gets the listing's facts (`listing_facts`), and the script step lists the facts
  it was written from.
- "Pick for me" chooses a product that is in stock, selling and not crowded, and says why.
- The rail can order results by Sales; a product that is out of stock is marked.
- Ember's `shop_search` can rank and narrow the results: by revenue, units, sales growth, commission,
  views gained in a day or least crowded; in stock only; a commission floor; a ceiling on how many
  videos sell it; a price ceiling; a category word. A ranking of products shows each product once.
  Ask in words: "skincare with at least 15% commission that is growing and not crowded".
- Pulling the rail wider on the Shop tab shows more about each video: under the poster, the product's
  7-day units and revenue, sales trend, commission, rating, how many videos sell it, views gained in
  a day and stock; wider still, the creator and category. The rail can be pulled to most of the page.
- Otherwise numbers are shown to the person only when they ask for numbers.

The product catalogue is read too, straight from Kaiyros with the same sign-in (`kaiyros_get`):

- `shop_products` searches products themselves, hundreds of thousands of them, by 7-day units, growth,
  commission or all-time units, with a commission floor, a price range and a category.
- `shop_search` with `product_id` lists the videos that sell one product, most viewed first.
- So a person can ask "what sells under $25 with at least 15% commission", pick one, and have its
  best video imported and the video laid out.
- The Shop tab has a **Videos | Products** switch. Products searches the catalogue with three orders
  (Selling, Growing, Commission). A click shows the videos that sell that product; while step 1 is
  waiting, a click uses the product for step 1, with its most viewed video to work from (or the
  listing alone when no video sells it yet).

Ember reads three more things, for answers only (none of them starts a video):

- `shop_brands`: brands and shops by units sold in 7 days, with the week before, estimated revenue,
  products, videos, creators, commission and shop rating. `seller_id` then narrows `shop_products`
  and `shop_search` to one brand.
- `video_trend`: one video's recorded daily views, to tell whether it is still climbing. The source
  rounds views and keeps only the days it recorded.
- `shop_market`: products, brands and units sold in 7 days across the catalogue, and which kinds of
  product have the most winning videos and views.

Not read: the creators list (its order and its product and brand filters did not respond when tried
on 12 November 2026, and its sales figures were months old) and the written hook and summary per
video (empty in today's data). Showing Kaiyros data outside this studio needs the owner's permission
first.

Ember may bring a Shop video in by itself only after the person has handed it the choice ("pick for
me", "the best one", "use that one"). Naming a kind of product is not enough: `shop_import` refuses
and Ember asks, with "Pick for me", "Let me choose" and "No product, my idea".

## Hard rules (from AGENTS.md)

- All rendering runs on our own GPU through the model server. No GPU job starts without a press on
  a priced button or an approval card.
- A selling video from another creator is for structure only. Its face, voice and words are never
  reused, and it cannot be put into Final video.
- Every export carries the AI-generated label in the file metadata (`comment`, `description`).
- An AI presenter states product facts and never claims to have used the product.
- No invented numbers. Views and sales are shown only when the person asks for numbers.
- Users never reach the GPU or see machine addresses. A failed step shows our own message as
  written; any other error is shown as "That did not work", with addresses and paths removed
  (`plain()` in `server/ember.py`).

## Where things live

| File | Role |
|---|---|
| `flow.js`, `flow.css` | The board: nodes, wires, rules (`may`, `wireRule`), guided drops (`offer`), locks (`filming`), tidy, selection |
| `studio.js`, `studio.css` | The shell: rail, message field and chat, menus, projects, uploads, the bridge `window.EmberStudio` |
| `easy.js`, `easy.css` | The step strip above the board and first-run simplifications |
| `server/ember.py` | Server: projects and files, Ember's loop and tools, board steps (`flow_script`, `flow_film`, `flow_picture`, `flow_voice`), export |
| `server/data/` | Per person, per project files. Not committed |
| `server/.env` | Model key. Not committed, never printed |

The board's graph is saved in the browser at once (`localStorage`, one per person and project) and,
a moment later, beside the project on the server (`board.json`, through `/api/board`). On load the
newer of the two wins, so the board is there in another browser or after the browser's storage is
cleared. The project (files, the cut, captions) is saved on the server.

## Ember's loop (the harness)

- One model, one loop, the tools in `TOOLS`. Each message carries the studio state and the board.
- What Ember re-reads of earlier turns is trimmed (`trim_history`): only the newest message carries
  a studio state, old pictures and long tool results are cut down, and the last ten turns are kept.
  Cuts fall on the person's messages, so a call always stays with its result.
- Rules that matter are enforced in code as well as in the instructions: no render without an
  approved price, nothing films or re-plans while the board says a render is running, the two choice
  buttons appear even if the model forgets them, and a failed step is worded plainly.
- Every turn adds a line to `turns.jsonl` beside the project (what was asked, the tools that ran,
  seconds, tokens). It is for audits and is never shown.
- Behaviour checks: `python3 server/tests/ember_eval.py` against a second server on port 4181. Nine
  quick checks; `--slow` adds ten that search, import and listen to real Shop videos and answer a
  seller's question from the data. They use the
  model key and never render. Run them after changing the instructions or a tool.

## Testing without spending

- The smoke test: start a second server (`EMBER_PORT=4181 uv run server/ember.py`), then
  `python3 server/tests/smoke.py`. Seventeen checks that spend nothing (served pages, projects, refusals,
  stop, approvals, no render without an approved price, plain error wording, saving the board, key and
  data files not served). Add `--model` for three more that use the model key (script writing, a commercial written as three
  shots, and that a described video is not rendered from chat).

- A second server for tests: `EMBER_PORT=4181 uv run server/ember.py`. Send chat or actions to it
  with the headers `X-Ember-User` and `X-Ember-Project`.
- Never press Film to test. Stop at the priced button, or stub the `flow_film` request in the page.
- Checked on 2026-11-12 on a test server: script writing for a Shop pick that is no longer in the
  results, an unknown action (400), stop with nothing running, a stale approval (404), export (file
  served, label in metadata), captions.

## Not built yet

- Lip-synced voices other than the video model's own; library and own voices are voiceovers.
- Supabase accounts and storage (`supabase/` holds the data model only).
- The phone layout is basic: the rail sits on top, the board opens fitted to the screen, a step opens
  as a sheet above the message field. It has not been tried on a real phone.
