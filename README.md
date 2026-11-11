<div align="center">

# Emberframe

**See what sells on TikTok Shop. Shoot it tonight.**

TikTok Shop data and a video studio in one product: find a product that is already selling,
cast your own creator, and our GPUs film a new video with sound.

**[See it live](https://smammadov1994.github.io/EmberFrame/)** · [Video library](https://smammadov1994.github.io/EmberFrame/library.html)

[![Emberframe landing page](docs/hero.jpg)](https://smammadov1994.github.io/EmberFrame/)

</div>

---

## What this is

The marketing site and library for Emberframe, as a static prototype. Plain HTML, CSS and
JavaScript. No framework, no build step, no backend.

It shows three things:

1. **The data.** A live pull of trending TikTok Shop videos with views, 7-day units and creators.
2. **The pipeline.** Our real n8n workflows, animated node by node, with what each node produces.
3. **The proof.** Clips rendered on our own GPUs, including side-by-side swaps of the same room,
   product and movements with a different person.

## A run through the pipeline

An ember travels the wires of the actual workflow. Each node it reaches lights up, and the
panel underneath shows what that node made: settings, screening checks, start pictures, a voice
track, and finally the finished video.

![A run through the Episode machine workflow](docs/pipeline.jpg)

The three workflows come from
[n8n-video-pipelines](https://github.com/smammadov1994/n8n-video-pipelines):

| Workflow | What it makes |
|---|---|
| **Swap machine** | Takes a selling product video and remakes it with your creator and one consistent voice |
| **Episode machine** | An AI presenter explains one question per episode, as a wide video and a vertical Short |
| **Cartoon machine** | Mango the cat teaches children one simple recipe per episode |

## Run it

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

Then open <http://127.0.0.1:4175/>. Any static file server works.

## What is inside

| File | What it does |
|---|---|
| `index.html` | Landing page: hero reel, Shop data, pipeline, pricing, consistency, library teaser, questions, footer |
| `library.html` | The video library. Three free previews, the rest locked until sign up |
| `config.js` | **The one place for prices, plans, products and example clips** |
| `pipelines.js` | The three n8n workflows as node graphs (names, types, positions, connections) |
| `flows.js` | One example run per workflow: the nodes it passes through and what each one outputs |
| `app.js` | Accounts, sign up and log in, library lock and unlock, tiles, the workflow run animation |
| `motion.js` | Scroll reveals, the reel fan, the footer wordmark, pointer spotlight |
| `particles.js` | The ember streams behind the page |
| `styles.css` | Everything visual |
| `media/` | Rendered clips, Shop previews, workflow stage pictures and the footer art |

### Changing prices

Edit `config.js`. Nothing else holds a price.

```js
videoRate: 0.04,   // dollars per video second
imagePrice: 0.02,  // dollars per still image
plans: [ /* Pay as you go, Creator, Creator Pro */ ]
```

## How it is built

- **No dependencies.** Fonts (Geist and Geist Mono) are the only thing loaded from outside.
- **Progressive motion.** Every animation is an enhancement. With JavaScript off, or with
  reduced motion turned on, the page is fully visible and static.
- **Videos behave.** They autoplay muted, loop, show a poster until loaded and pause off screen.
  Click one for sound.
- **Works on a phone.** No sideways scroll at 375px, tap targets at least 44px tall.

![The footer](docs/footer.jpg)

## What is real and what is not

This is a prototype. Being straight about where the edges are:

| Part | State |
|---|---|
| Shop data on the page | Real, pulled from Kaiyros Discover on 2026-11-11. A snapshot, not a live feed |
| Rendered clips | Real output from our own pipelines |
| Workflow graphs and node outputs | Taken from the real workflow files and real intermediate pictures |
| Accounts | **A stub.** Sign up and log in are stored in your browser's `localStorage`. This is not real security and must be replaced before launch |
| Rendering from the site | Not connected. Nothing on the page starts a GPU |
| Payments | Not connected. Nothing is charged |
| Prices | Proposals, not tested |
| "Post to TikTok" step | Not built yet |

Text in square brackets, such as `[YOUR COMPANY NAME]` and `[YOUR REFUND POLICY]`, marks a
decision that is still open.

## Notes on content

- **AI disclosure.** Every clip we rendered is AI-generated and is labelled as such in the
  captions and the footer. In side-by-side swap clips, the right half is the AI-generated remake.
- **Swap clips.** The creators shown in the side-by-side clips agreed to this feature. A
  reference video guides structure only; we do not copy another creator's face, voice or words.
- **Library previews.** The clips under `media/kaiyros/` are 12-second previews of TikTok videos
  that belong to their original creators, shown with their handles. They are not ours and are
  not AI-generated.
- **Model.** Video is powered by MiniMax H3 (HyperFlow H3 Flash). Check the model licence before
  commercial use.
- **Name.** "Emberframe" is a working name.

---

<div align="center">

Built for the ones who would rather direct than render.

</div>
