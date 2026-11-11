// One example run per n8n workflow: the nodes it passes through, in order, and
// what each node hands to the next. Node names match pipelines.js (the real
// workflow files). Settings values are the ones in those files; pictures are
// real intermediate images and frames from our own runs (media/flow/).
window.EMBER_RUNS = {
  'swap-machine': [
    { node: 'Every 30 minutes', ms: 650, text: 'The schedule fires. Nobody presses anything.', out: { kind: 'json', rows: [['trigger', '"schedule"'], ['every', '"30 minutes"']] } },
    { node: 'Settings', ms: 750, text: 'Which Shop data list to pull from, how many videos to look at and how many to keep.', out: { kind: 'json', rows: [['list', '"trending"'], ['look_at', '60'], ['keep', '14']] } },
    { node: 'Pick and prepare clips', ms: 2800, thumb: 'media/flow/swap_orig.jpg', text: 'Pulls selling videos from the Shop data and screens each one on six frames. Keepers are transcribed and every line is respoken in the presenter\'s voice.', out: { kind: 'checks', src: 'media/flow/swap_orig.jpg', items: ['One person', 'Face visible, talking', 'Product in hand', 'Voice track ready'] } },
    { node: 'Send to swap machine', ms: 2800, thumb: 'media/flow/swap_new.jpg', text: 'The clip goes to the swap GPU. The room, the product and the movements stay. The person changes.', out: { kind: 'wipe', src: 'media/flow/swap_orig.jpg', src2: 'media/flow/swap_new.jpg' } },
    { node: 'Collect finished swaps', ms: 3200, thumb: 'media/flow/swap_new.jpg', text: 'The finished, AI-generated video comes back, with a small file holding creator, product and words.', out: { kind: 'video', video: { src: 'media/flow/swap_remade.mp4', poster: 'media/flow/swap_new.jpg' } } },
    { node: 'Read result', ms: 1200, text: 'Every step answers in one line of JSON, so the workflow knows what happened and a failed step never kills a run.', out: { kind: 'json', rows: [['ok', 'true'], ['creator', '"..."'], ['product', '"..."'], ['words', '"..."']] } }
  ],
  'episode-machine': [
    { node: 'Every 10 minutes', ms: 600, text: 'The schedule fires and checks whether there is work to do.', out: { kind: 'json', rows: [['trigger', '"schedule"'], ['every', '"10 minutes"']] } },
    { node: 'Topics', ms: 1500, text: 'The list the machine works through, top to bottom.', out: { kind: 'lines', items: ['Why the ocean is salty', 'Where lakes come from', 'How bees turn nectar into honey'] } },
    { node: 'Pick next topic', ms: 900, text: 'Skips any topic that already has a finished episode and takes the next one.', out: { kind: 'json', rows: [['go', 'true'], ['topic', '"Where lakes come from"']] } },
    { node: 'Read pick', ms: 500, text: 'Reads the one-line answer from the step before.', out: { kind: 'json', rows: [['go', 'true']] } },
    { node: 'Go?', ms: 550, text: 'There is a topic to make, so the run takes the true branch.', out: { kind: 'json', rows: [['go', 'true'], ['branch', '"true"']] } },
    { node: 'Plan episode', ms: 3000, thumb: 'media/flow/edu_1.jpg', text: 'The script is written, every fact is checked, and lines that read badly out loud are rewritten. Then one start picture per place is made from the presenter\'s master picture.', out: { kind: 'grid', items: ['media/flow/edu_1.jpg', 'media/flow/edu_2.jpg', 'media/flow/edu_3.jpg', 'media/flow/edu_4.jpg'] } },
    { node: 'Read plan', ms: 500, text: 'The plan step reports that it finished.', out: { kind: 'json', rows: [['ok', 'true']] } },
    { node: 'Planned?', ms: 550, text: 'The plan is good, so the run goes on to shooting.', out: { kind: 'json', rows: [['ok', 'true'], ['branch', '"true"']] } },
    { node: 'Shoot episode', ms: 3000, thumb: 'media/flow/edu_2.jpg', text: 'Voice first: the line is spoken, then the clip is generated around that audio. Each clip is checked three ways, with up to four tries per take.', out: { kind: 'checks', src: 'media/flow/edu_2.jpg', items: ['Words match the script', 'Still her face', 'No big mistakes'] } },
    { node: 'Finish', ms: 1100, thumb: 'media/edu_lakes_wide.jpg', text: 'Clean episodes go on the publish list. Flagged ones wait for a person.', out: { kind: 'json', rows: [['status', '"ready"']] } },
    { node: 'Read result', ms: 500, text: 'Reads the status.', out: { kind: 'json', rows: [['status', '"ready"']] } },
    { node: 'Clean?', ms: 550, text: 'Status is ready, so it can be published.', out: { kind: 'json', rows: [['status', '"ready"'], ['branch', '"true"']] } },
    { node: 'Upload to YouTube', ms: 3400, thumb: 'media/edu_lakes_wide.jpg', text: 'The finished, AI-generated episode is published. Publishing is spaced to one episode every 3 hours.', out: { kind: 'video', video: { src: 'media/edu_lakes_wide.mp4', poster: 'media/edu_lakes_wide.jpg' } } },
    { node: 'Read upload', ms: 1200, text: 'The upload step reports back and the run ends.', out: { kind: 'json', rows: [['ok', 'true']] } }
  ],
  'cartoon-machine': [
    { node: 'Run once now', ms: 650, text: 'Started by hand for one episode.', out: { kind: 'json', rows: [['trigger', '"manual"']] } },
    { node: 'Episode', ms: 1700, text: 'Which episode to make. Its script lists, scene by scene, what Mango says, what the picture shows and what happens.', out: { kind: 'lines', quote: true, items: ['Hello, little chefs! It is Mango.', 'First, crack two eggs into the bowl.', 'Tap, tap, crack!'] } },
    { node: 'Make start pictures', ms: 3000, thumb: 'media/flow/mango_1.jpg', text: 'One start picture per scene. Each is made from the one before, so the cat, the kitchen and the props stay identical.', out: { kind: 'grid', items: ['media/flow/mango_1.jpg', 'media/flow/mango_2.jpg', 'media/flow/mango_3.jpg', 'media/flow/mango_4.jpg'] } },
    { node: 'Record Mango\'s voice', ms: 2400, thumb: 'media/flow/mango_2.jpg', text: 'Every line is spoken in Mango\'s voice before any clip is made.', out: { kind: 'wave' } },
    { node: 'Shoot the scenes', ms: 2800, thumb: 'media/flow/mango_4.jpg', text: 'Each scene is filmed from its start picture, with up to four tries.', out: { kind: 'image', src: 'media/flow/mango_4.jpg' } },
    { node: 'Join and make Short', ms: 3400, thumb: 'media/mango_omelet.jpg', text: 'The scenes are joined into one AI-generated episode, and a vertical Short is cut from it.', out: { kind: 'video', video: { src: 'media/mango_omelet.mp4', poster: 'media/mango_omelet.jpg' } } },
    { node: 'Read result', ms: 1200, text: 'The last step reports back and the run ends.', out: { kind: 'json', rows: [['ok', 'true'], ['episode', '"omelet"']] } }
  ]
};
