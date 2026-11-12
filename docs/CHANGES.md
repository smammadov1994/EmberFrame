# What changed in the studio

Newest first. Each line is something a person using the studio would notice. The rules themselves
are in [STUDIO.md](STUDIO.md).

## 12 November 2026

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
