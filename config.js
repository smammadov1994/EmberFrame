// Single source of truth for prices, plans and sample data.
// Prices are proposals, not tested. Change them here only.
window.EMBER_CONFIG = {
  videoRate: 0.04, // dollars per video second
  imagePrice: 0.02, // dollars per still image
  clipSeconds: { min: 5, max: 15, default: 8 },
  renderSecondsPerClipSecond: 92 / 5.2, // HyperFlow H3 Flash on one RTX 5090
  plans: [
    { id: 'payg', name: 'Pay as you go', detail: 'Prepaid balance in $10 steps', price: null },
    { id: 'creator', name: 'Creator', detail: '600 video seconds, 1 avatar', price: 49 },
    { id: 'pro', name: 'Creator Pro', detail: '2,400 seconds, 5 avatars, batches', price: 149 }
  ],
  freePreviews: 3,

  // Saved creators are SAMPLE names until accounts hold real ones.
  creators: ['Juno', 'Rafa', 'Mei'],
  // Real selling videos pulled from Kaiyros Discover (sort: trending) on 2026-11-11.
  // `units` is Kaiyros' 7-day unit count where it is measured, else null. `views` is the
  // video's total views at pull time. Files are 12 second previews of the original
  // creators' TikTok videos. Owner must confirm Kaiyros data rights before this goes public.
  dataPulled: '2026-11-11',
  products: [
    { name: 'Push-up board kit', cat: 'Lifestyle', units: '3,190', views: '6.9M', viewsN: 6900000, creator: 'uncle.steele6', src: 'media/kaiyros/001.mp4', poster: 'media/kaiyros/001.jpg' },
    { name: 'Noodle squishy toy', cat: 'Lifestyle', units: null, views: '11.3M', viewsN: 11300000, creator: 'hiofdr6', src: 'media/kaiyros/002.mp4', poster: 'media/kaiyros/002.jpg' },
    { name: 'Faux fur clutch bag', cat: 'Lifestyle', units: null, views: '2.0M', viewsN: 2000000, creator: 'aaliyahsfinds', src: 'media/kaiyros/003.mp4', poster: 'media/kaiyros/003.jpg' },
    { name: 'Purple teeth whitening strips', cat: 'Beauty', units: '23,729', views: '65.5M', viewsN: 65500000, creator: 'reedsdeals', src: 'media/kaiyros/004.mp4', poster: 'media/kaiyros/004.jpg' },
    { name: 'Wireless CarPlay adapter', cat: 'Tech', units: null, views: '2.8M', viewsN: 2800000, creator: 'dangdeals', src: 'media/kaiyros/005.mp4', poster: 'media/kaiyros/005.jpg' },
    { name: 'Shark PowerPro cordless vacuum', cat: 'Home', units: null, views: '2.1M', viewsN: 2100000, creator: 'stephanie_ann_05', src: 'media/kaiyros/006.mp4', poster: 'media/kaiyros/006.jpg' },
    { name: 'Christmas tree projector light', cat: 'Home', units: null, views: '4.6M', viewsN: 4600000, creator: 'dgt5hh', src: 'media/kaiyros/007.mp4', poster: 'media/kaiyros/007.jpg' },
    { name: 'R36S retro handheld console', cat: 'Tech', units: '8,497', views: '3.7M', viewsN: 3700000, creator: 'jess_reviews_ttshop', src: 'media/kaiyros/008.mp4', poster: 'media/kaiyros/008.jpg' },
    { name: 'Fleece throw blanket', cat: 'Home', units: '8,450', views: '21.6M', viewsN: 21600000, creator: 'macsmotion', src: 'media/kaiyros/009.mp4', poster: 'media/kaiyros/009.jpg' },
    { name: 'Solar Christmas stake lights', cat: 'Home', units: null, views: '1.3M', viewsN: 1300000, creator: 'honestlyitsjessica', src: 'media/kaiyros/010.mp4', poster: 'media/kaiyros/010.jpg' },
    { name: 'Dr.G skincare bundle', cat: 'Beauty', units: null, views: '7.7M', viewsN: 7700000, creator: 'theallisonveer', src: 'media/kaiyros/011.mp4', poster: 'media/kaiyros/011.jpg' },
    { name: 'Magnetic LED work light', cat: 'Home', units: null, views: '3.3M', viewsN: 3300000, creator: 'feloniahanser', src: 'media/kaiyros/012.mp4', poster: 'media/kaiyros/012.jpg' }
  ],

  // "Shot on our cards": real renders from our pipelines, files in media/.
  // Side-by-side clips show the original
  // creator on the left (creators agreed to this feature) and the remake on the right.
  examples: [
    { group: 'swap', title: 'Bottle buddy', note: 'Original left, our presenter right, in her own voice', src: 'media/swap_bottle_buddy.mp4', poster: 'media/swap_bottle_buddy.jpg', aspect: '9 / 8' },
    { group: 'swap', title: 'Retro console', note: 'From an unattended overnight batch', src: 'media/swap_retro_console.mp4', poster: 'media/swap_retro_console.jpg', aspect: '9 / 8' },
    { group: 'swap', title: 'First trial', note: 'Same room, same product, same movements', src: 'media/swap_first_trial.mp4', poster: 'media/swap_first_trial.jpg', aspect: '9 / 8' },
    { group: 'wide', title: 'Where lakes come from', note: 'Educational presenter, wide cut', src: 'media/edu_lakes_wide.mp4', poster: 'media/edu_lakes_wide.jpg', aspect: '16 / 9' },
    { group: 'wide', title: 'Mango makes an omelet', note: 'Kids cartoon, five shots', src: 'media/mango_omelet.mp4', poster: 'media/mango_omelet.jpg', aspect: '16 / 9' },
    { group: 'wide', title: 'Mango makes a PB&J', note: 'Kids cartoon, six shots', src: 'media/mango_pbj.mp4', poster: 'media/mango_pbj.jpg', aspect: '16 / 9' },
    { group: 'wide', title: 'Mango makes a fruit cup', note: 'Kids cartoon, first test', src: 'media/mango_fruit_cup.mp4', poster: 'media/mango_fruit_cup.jpg', aspect: '16 / 9' }
  ],
  heroVideo: { src: 'media/swap_bottle_buddy.mp4', poster: 'media/swap_bottle_buddy.jpg', aspect: '9 / 8' },
  // Hero reel: renders from our own GPUs (text to video and image to video).
  reel: [
    { title: 'Savanna walk', src: 'media/reel/savanna_walk.mp4', poster: 'media/reel/savanna_walk.jpg', aspect: '9 / 16' },
    { title: 'Storm night', src: 'media/reel/gator_storm.mp4', poster: 'media/reel/gator_storm.jpg', aspect: '9 / 16' },
    { title: 'Presenter', src: 'media/reel/presenter.mp4', poster: 'media/reel/presenter.jpg', aspect: '9 / 16' },
    { title: 'Ocean court', src: 'media/reel/ocean_court.mp4', poster: 'media/reel/ocean_court.jpg', aspect: '9 / 16' },
    { title: 'Mango the cat', src: 'media/reel/mango.mp4', poster: 'media/reel/mango.jpg', aspect: '9 / 16' }
  ],


  ideas: [
    'A neon-lit ramen stall in the rain, steam curling off the bowl, slow push in',
    'My sneaker drop: the shoe spins on wet concrete, sparks behind it',
    'A golden retriever in sunglasses skateboards past the camera, crowd cheering'
  ]
};
