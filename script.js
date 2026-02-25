// ==================== SIMPLIFIED VIDEO SCROLL - WORKS ON ALL DEVICES ====================

class ScrollVideoSection {
  constructor(section) {
    // iOS detection
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    this.section = section;
    this.canvas = section.querySelector("canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;

    this.src = section.dataset.video;
    this.duration = Number(section.dataset.duration || 5);
    
    this.autoplaySeconds = Number(section.dataset.autoplay || 0);
    this.isIntro = this.autoplaySeconds > 0;

    // For mobile - we'll use direct video playback
    this.useDirectVideo = this.isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    this.frames = [];
    this.ready = false;
    this.fallbackMode = this.useDirectVideo; // Start in fallback mode for mobile

    this.resize = this.resize.bind(this);
    this.onScroll = this.onScroll.bind(this);

    this.init();
  }

  async init() {
    if (this.canvas) {
      this.resize();
      window.addEventListener("resize", this.resize);
    }

    // For mobile, immediately use direct video
    if (this.useDirectVideo) {
      console.log("Mobile detected - using direct video playback");
      this.enableDirectVideoMode();
      return;
    }

    // Desktop: Try frame extraction
    if (this.isIntro) {
      this.videoPlayback = this.section.querySelector("video.playback");
      this.videoExtractor = this.section.querySelector("video.extractor");

      if (!this.videoPlayback || !this.videoExtractor) {
        console.error("Intro section needs 2 videos");
        this.enableDirectVideoMode();
        return;
      }

      this.setupVideo(this.videoPlayback);
      this.setupVideo(this.videoExtractor);

      this.videoPlayback.src = this.src;
      this.videoExtractor.src = this.src;

      try {
        await Promise.all([
          this.waitForVideo(this.videoPlayback),
          this.waitForVideo(this.videoExtractor)
        ]);

        const extractSuccess = await this.extractFrames(this.videoExtractor);
        
        if (extractSuccess && this.frames.length > 0) {
          this.ready = true;
          await this.playIntroOnCanvas(this.videoPlayback, this.autoplaySeconds);
          window.addEventListener("scroll", this.onScroll);
        } else {
          this.enableDirectVideoMode();
        }
        
      } catch (e) {
        console.error("Video initialization failed:", e);
        this.enableDirectVideoMode();
      }

    } else {
      this.video = this.section.querySelector("video");

      if (!this.video) {
        console.error("Normal scroll section needs 1 <video> tag");
        return;
      }

      this.setupVideo(this.video);
      this.video.src = this.src;

      try {
        await this.waitForVideo(this.video);
        
        const extractSuccess = await this.extractFrames(this.video);
        
        if (extractSuccess && this.frames.length > 0) {
          this.ready = true;
          this.drawFrame(0);
          window.addEventListener("scroll", this.onScroll);
        } else {
          this.enableDirectVideoMode();
        }
        
      } catch (e) {
        console.error("Video initialization failed:", e);
        this.enableDirectVideoMode();
      }
    }
  }

  enableDirectVideoMode() {
    console.log("Enabling direct video mode");
    this.fallbackMode = true;
    this.ready = true;
    
    // Hide canvas
    if (this.canvas) {
      this.canvas.style.display = "none";
    }
    
    // Get the appropriate video element
    let video = this.isIntro ? this.section.querySelector("video.playback") : this.section.querySelector("video");
    
    if (!video) {
      video = this.section.querySelector("video");
    }
    
    if (video) {
      // Setup video for direct playback
      video.style.display = "block";
      video.style.position = "absolute";
      video.style.top = "0";
      video.style.left = "0";
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      
      // Ensure video is properly configured
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      
      // Load the video source if not already set
      if (!video.src && this.src) {
        video.src = this.src;
        video.load();
      }
      
      // For non-intro sections, use intersection observer
      if (!this.isIntro) {
        this.setupIntersectionObserver(video);
      } else {
        // For intro, just play once
        video.play().catch(e => console.log("Intro play failed:", e));
      }
      
      // Also handle scroll for progress-based seeking (works on desktop)
      if (!this.isIOS) {
        window.addEventListener("scroll", () => this.onScrollFallback(video));
      }
    }
  }

  setupIntersectionObserver(video) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Play when visible
          video.play().catch(e => console.log("Play failed:", e));
        } else {
          // Pause when hidden
          video.pause();
        }
      });
    }, { threshold: 0.3 });
    
    observer.observe(video);
  }

  setupVideo(video) {
    if (!video) return;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    
    if (this.isIOS) {
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
    }
  }

  waitForVideo(video) {
    return new Promise((resolve, reject) => {
      if (!video) {
        reject(new Error('No video element'));
        return;
      }
      
      if (video.readyState >= 2) {
        resolve();
      } else {
        const timeout = setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 10000);

        video.addEventListener('loadeddata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

        video.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Video failed to load'));
        }, { once: true });
      }
    });
  }

  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  async playIntroOnCanvas(video, seconds) {
    try {
      await video.play();
    } catch (e) {
      console.log("Intro autoplay blocked");
      return;
    }

    const start = performance.now();

    return new Promise(resolve => {
      const draw = () => {
        const elapsed = (performance.now() - start) / 1000;

        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        this.ctx.drawImage(video, 0, 0, window.innerWidth, window.innerHeight);

        if (elapsed >= seconds || video.paused || video.ended) {
          video.pause();
          resolve();
          return;
        }

        requestAnimationFrame(draw);
      };

      requestAnimationFrame(draw);
    });
  }

  async extractFrames(videoElement) {
    if (!videoElement) return false;
    
    this.frames.length = 0;
    
    // Limit frames for performance
    const maxFrames = 40;
    const frameStep = Math.max(1, Math.ceil(this.totalFrames / maxFrames));
    
    let successCount = 0;
    
    for (let i = 0; i < this.totalFrames; i += frameStep) {
      const t = (i * this.sampleEvery) / this.fps;
      
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Seek timeout')), 2000);
          
          const onSeek = () => {
            clearTimeout(timeout);
            videoElement.removeEventListener("seeked", onSeek);
            resolve();
          };
          
          videoElement.addEventListener("seeked", onSeek, { once: true });
          videoElement.currentTime = t;
        });

        const bmp = await createImageBitmap(videoElement);
        this.frames.push(bmp);
        successCount++;
        
        if (i % 10 === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
        
      } catch (e) {
        console.warn(`Frame ${i} extraction failed:`, e);
      }
    }
    
    return successCount > 0;
  }

  onScrollFallback(video) {
    if (!video || this.isIOS) return;
    
    const scrollTop = window.scrollY;
    const sectionTop = this.section.offsetTop;
    const scrollLength = this.section.offsetHeight - window.innerHeight;
    
    if (scrollLength <= 0) return;
    
    const progress = Math.min(
      Math.max((scrollTop - sectionTop) / scrollLength, 0),
      1
    );
    
    try {
      video.currentTime = progress * this.duration;
    } catch (e) {
      // Ignore seeking errors
    }
  }

  onScroll() {
    if (!this.ready || this.fallbackMode) return;

    if (this.frames.length === 0) return;

    const scrollTop = window.scrollY;
    const sectionTop = this.section.offsetTop;
    const scrollLength = this.section.offsetHeight - window.innerHeight;

    if (scrollLength <= 0) return;

    let progress = Math.min(
      Math.max((scrollTop - sectionTop) / scrollLength, 0),
      1
    );

    if (this.isIntro) {
      const startFrame = Math.floor((this.autoplaySeconds * this.fps) / this.sampleEvery);
      const adjustedStart = Math.min(Math.max(startFrame, 0), this.frames.length - 1);
      
      if (this.frames.length > adjustedStart) {
        const remainingFrames = this.frames.length - 1 - adjustedStart;
        const index = adjustedStart + Math.floor(progress * remainingFrames);
        this.drawFrame(Math.min(index, this.frames.length - 1));
      }
    } else {
      const index = Math.floor(progress * (this.frames.length - 1));
      this.drawFrame(Math.min(index, this.frames.length - 1));
    }
  }

  drawFrame(index) {
    const frame = this.frames[index];
    if (!frame || !this.ctx) return;

    try {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    } catch (e) {
      console.warn('Draw error:', e);
    }
  }
}

// ==================== INITIALIZE EVERYTHING ====================

document.addEventListener("DOMContentLoaded", () => {
  // Add iOS class to body
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    document.body.classList.add('ios-device');
  }
  
  // Initialize video sections
  document.querySelectorAll(".scroll-video").forEach(section => {
    new ScrollVideoSection(section);
  });

  // Intersection Observer for reveal elements
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active", "is-visible");
      } else {
        entry.target.classList.remove("active", "is-visible");
      }
    });
  }, {
    threshold: 0.2
  });

  // Observe all reveal elements
  document.querySelectorAll(".reveal, .reveal-toggle, .reveal-stagger, .section-title, .section-description").forEach(el => {
    observer.observe(el);
  });

  // Stagger animation for amenities
  const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const items = document.querySelectorAll(".feature-card");
        items.forEach((item, index) => {
          setTimeout(() => {
            item.classList.add("active");
          }, index * 100);
        });
      }
    });
  }, {
    threshold: 0.2
  });

  const amenitiesSection = document.querySelector(".amenities-section");
  if (amenitiesSection) staggerObserver.observe(amenitiesSection);

  // Split text animation for intro
  const title = document.querySelector(".intro-title");
  if (title) {
    const text = title.innerText;
    title.innerHTML = "";
    text.split("").forEach((char, index) => {
      const span = document.createElement("span");
      span.textContent = char === " " ? "\u00A0" : char;
      span.style.animationDelay = `${index * 0.05}s`;
      span.style.display = "inline-block";
      span.style.opacity = "0";
      span.style.animation = "fadeInUp 0.5s ease forwards";
      title.appendChild(span);
    });
  }

  // Add keyframe animation for text
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  // AOS initialization
  if (typeof AOS !== 'undefined') {
    AOS.init({ 
      duration: 1000, 
      once: false 
    });
  }

  // 3D Parallax Hero Title (disable on mobile)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (!isMobile) {
    const hero = document.getElementById("hero3D");
    if (hero) {
      document.addEventListener("mousemove", (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 10;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;
        hero.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
      });

      document.addEventListener("mouseleave", () => {
        hero.style.transform = "rotateX(0deg) rotateY(0deg)";
      });
    }
  }

  // Loader handling
  const loader = document.getElementById("site-loader");
  const curtain = document.getElementById("curtain");
  
  if (loader) {
    const MIN_TIME = 2000;
    const start = Date.now();

    // Hide loader when page is loaded
    if (document.readyState === 'complete') {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_TIME - elapsed);
      
      setTimeout(() => {
        hideLoader(loader, curtain);
      }, wait);
    } else {
      window.addEventListener("load", () => {
        const elapsed = Date.now() - start;
        const wait = Math.max(0, MIN_TIME - elapsed);

        setTimeout(() => {
          hideLoader(loader, curtain);
        }, wait);
      });
    }

    // Safety fallback
    setTimeout(() => {
      if (loader.style.display !== "none") {
        hideLoader(loader, curtain);
      }
    }, 5000);
  }
  
  function hideLoader(loader, curtain) {
    loader.classList.add("exiting");
    
    setTimeout(() => {
      loader.style.display = "none";
      if (curtain) {
        curtain.classList.add("open");
      }
    }, 1000);
  }
});

// Handle visibility change to save memory
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    document.querySelectorAll("video").forEach(video => {
      if (!video.paused) video.pause();
    });
  }
});

// Add mobile-specific CSS
const mobileCSS = `
@media (max-width: 768px) {
  .scroll-video canvas {
    display: none !important;
  }
  
  .scroll-video video {
    display: block !important;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .scroll-video {
    height: 100vh !important;
  }
  
  .scroll-spacer {
    display: none;
  }
  
  .sticky-wrap {
    position: relative !important;
    height: 100vh;
    overflow: hidden;
  }
  
  .overlay-content {
    background: rgba(0, 0, 0, 0.3);
  }
  
  /* Ensure text is readable on mobile */
  .text-panel {
    background: rgba(0, 0, 0, 0.6);
    padding: 20px;
    border-radius: 10px;
    backdrop-filter: blur(5px);
    margin: 0 20px;
  }
}
`;

// Add the CSS to the page
const styleElement = document.createElement('style');
styleElement.textContent = mobileCSS;
document.head.appendChild(styleElement);