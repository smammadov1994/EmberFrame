# What changed in the studio

Newest first. Each line is something a person using the studio would notice. The rules themselves
are in [STUDIO.md](STUDIO.md).

## 12 November 2026

**Found by trying to beat it** (`server/tests/redteam.py`)
- A price of `NaN` rendered for free. Fixed: a price that is not a real number is no price.
- Three fast presses on Film started three renders. Fixed: one render at a time for each account.
- Nothing checked what was typed into a script box before it was filmed. Now a line where the
  presenter claims to have used the product, a real named person, a cure, sexual content, or
  "do not label this as AI" is refused before the price, with what to change.
- A script was written from an empty idea or a file that no longer exists. Now refused.
- Sales figures typed into an idea ("sold 2 million this week") went into the script. Now only
  the listing's own figures do.
- Ember did not know the prices ("Unknown"), and quoted $0.32 for a commercial that costs $0.63.
  It is now told the prices and a commercial is priced by its shots.
- Ember rendered from chat instead of laying a video out. From chat it can now only add a shot to
  a video that already has one; a new video is always laid out on the canvas.
- A library voice was bought from a chat message with no tap. It now shows a card first.
- Asked for a Python script, Ember wrote one. It now says that is outside the studio.
- A message over 6,000 characters was cut silently and the cut part ignored. It is now refused
  whole, and the page says so before sending.
- Broken requests (a body that is not JSON, text where a number belongs) crashed the server with
  a 500. They are refused with a plain message.

**Filming again**
- A Film it step keeps one take in Final video. Film another take, or filming after the script
  changed, replaces the earlier clips from that step instead of adding to them. They stay in Media.
  Before this, a re-filmed commercial left five or six shots in the video.
- A commercial films again only from the first shot whose words changed, and charges for those.
- A voiceover moves with its clip and leaves the video with it. Before this, taking a clip out
  left its voice playing over whatever came next.

**Ember's answers and the Shop tab**
- When Ember looks up products, the Shop tab switches to what it found. The products its answer
  names go to the top, marked "In Ember's answer". The buttons under that answer are about the
  product: see its selling videos, make a video for it, who sells the most of these.
- When Ember fetches videos, the Shop tab switches back to Videos.
- While Ember works, three dots show in the message field (they give way when you type) and one
  light circles the chat panel. Panels are no longer lit one by one.

**Where things are**
- Every step now opens in the left rail. The board is never covered by a panel.
- Step 1 is chosen in the rail itself: Shop (with search and Trending / Most viewed) or Media, or
  "Chat about it instead".
- Chat is one field at the bottom centre of the board. The conversation slides in on the left when
  you send a message and can be hidden again.
- Nothing opens by itself when the page loads. The step that is waiting says "Start here".

**Rules and guards**
- Steps follow one order, and the "What comes next?" menu greys what cannot follow and says why.
- Wires that break a rule are refused with the reason.
- With Guided on, a dropped file goes to the step that is waiting, or is stopped with a message.
- Typing is one more way to answer a step. It never renders and never asks for money.
- A click on a Shop video fills step 1 or says why it cannot. It is never sent to Ember.
- While a clip is filming its steps are read-only; delete, rewire, Start over and a new product are
  refused. While Ember is working, board steps wait.
- Deleting a file and clearing the avatar take two clicks. Start over wipes the board and asks once
  when the video has clips.
- Another creator's selling video cannot be added to the final video.

**Ember**
- Asks whether you want to choose the product or have it pick.
- Lays a video out as steps on the board (`plan_video`) instead of rendering from chat, and says
  which product and picture it used and why.
- Hooks and script ideas come from how the most viewed Shop videos really open (`find_hooks`).
- Reads the board with every message: what is chosen, what is waiting, whether a render is running.
- Does only what was asked; offers the rest as buttons.
- With no avatar saved it no longer stalls asking for a photo: it lays the video out and leaves
  who is on camera to step 2.
- Its memory of earlier turns stays small and current, so long sessions do not slow down or act on
  an old picture of the project.
- `server/tests/ember_eval.py`: fourteen behaviour checks (asks first, lays out instead of
  rendering, reads the board, holds back during a render, hooks from real videos, no leaks).

**Look**
- "What to make" has a Look: phone footage or cinematic commercial. Cinematic is briefed like an
  advert and rendered at the highest quality. A product on its own starts as cinematic.

**Commercial**
- "What to make" has a new kind: Commercial. Two to four cinematic shots, written as one story,
  filmed one after another and cut together in Final video. Nobody speaks. The price is per shot
  and shown up front. Not yet rendered for real.
- A commercial that stops part way keeps the shots it filmed; trying again films and charges only
  the shots left.
- Ask Ember for a commercial, an advert or something cinematic and it lays out this kind.
- Type an idea that says commercial, advert or cinematic, with no one on camera, and step 3 opens
  on Commercial instead of a single shot. "My own idea" now says it films one continuous shot.
- When Ember asks whose choice the product is, there is a third button: "No product, my idea".

**More Shop data for Ember**
- Brands: who sold the most this week against the week before, with products, videos, creators,
  commission and shop rating (`shop_brands`); then one brand's products or videos.
- Whether one selling video is still climbing, from its recorded daily views (`video_trend`).
- The market as a whole: products, brands, units in 7 days, and which kinds of product have the
  most winning videos (`shop_market`).
- Ember can no longer bring a Shop video in on its own when you only named a kind of product. It
  asks whose choice it is first; the server refuses the import otherwise.

**Shop data**
- Every Shop video now carries its product's sales, revenue trend, reviews, stock, commission and how
  many videos and creators already sell it.
- "Pick for me" uses that and says why. The script step lists the facts it was written from.
- The rail can order results by Sales, and marks products that are out of stock.
- Ask Ember for products by what matters to a seller: commission, growth, how crowded, stock, price.
- Pull the rail wider on the Shop tab and each video shows its product's numbers under the poster.
- The Shop tab has a Videos | Products switch: browse the catalogue by Selling, Growing or Commission,
  click a product to see its videos, or use it for step 1.
- Ember can search the product catalogue itself (what sells, what grows, what pays most, by price
  and category), then find the videos selling one product and set a video up from the best.

**Sturdier**
- A render survives a page reload: the Film step keeps waiting and wires the clip in when it arrives.
- The board is saved on the server as well as in the browser.
- A picked Shop product still works after another search.
- Failed steps show a plain reason; addresses and file paths never reach the browser.
- Stop reaches the right job (a render or the chat).
- `server/tests/smoke.py`: seventeen checks that spend nothing, two more with `--model`.

**Board tools**
- Drag on the empty board to select several nodes; move, delete or let go of them together.
- Fit tidies the layout, then fits it in view. New clips land to the right; Final video stays last.
- The Final video node appears only when there is something to put in it, and shows a moving wire
  while a clip is filming.

## 11 November 2026

- The canvas became the whole studio; the old editor is no longer shown.
- Guided workflow: subject, on camera, what to make, script, voice, film.
- Fish Audio voices, word-timed captions, Shop search with a hundred results a page.
- Menu bar, projects, history, drop files anywhere, one message box.

## Not checked yet

- A real render from start to finish after these changes (no render was started while testing).
- A real phone. The phone layout was checked at phone width in a desktop browser only.
- Real mouse drags and a real microphone; drags were simulated.
