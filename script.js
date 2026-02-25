// ==================== DESKTOP VERSION (Full Features) ====================
class DesktopScrollVideo {
  constructor(section) {
    this.section = section;
    this.canvas = section.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");

    this.src = section.dataset.video;
    this.duration = Number(section.dataset.duration || 0);
    this.fps = Number(section.dataset.fps || 30);
    this.sampleEvery = Number(section.dataset.sample || 4);

    this.autoplaySeconds = Number(section.dataset.autoplay || 0);
    this.isIntro = this.autoplaySeconds > 0;

    this.totalFrames = Math.floor((this.duration * this.fps) / this.sampleEvery);

    this.frames = [];
    this.ready = false;
    this.fallbackMode = false;

    this.resize = this.resize.bind(this);
    this.onScroll = this.onScroll.bind(this);

    this.init();
  }

  async init() {
    this.resize();
    window.addEventListener("resize", this.resize);

    if (this.isIntro) {
      this.videoPlayback = this.section.querySelector("video.playback");
      this.videoExtractor = this.section.querySelector("video.extractor");

      if (!this.videoPlayback || !this.videoExtractor) {
        console.error("Intro section needs 2 videos");
        return;
      }

      this.setupVideo(this.videoPlayback);
      this.setupVideo(this.videoExtractor);

      this.videoPlayback.src = this.src;
      this.videoExtractor.src = this.src;

      this.videoPlayback.load();
      this.videoExtractor.load();

      this.videoExtractor.addEventListener("loadeddata", async () => {
        await this.extractFrames(this.videoExtractor);
        this.ready = true;
        await this.playIntroOnCanvas(this.videoPlayback, this.autoplaySeconds);
        this.onScroll();
        window.addEventListener("scroll", this.onScroll);
      });

    } else {
      this.video = this.section.querySelector("video");

      if (!this.video) {
        console.error("Normal scroll section needs 1 <video> tag");
        return;
      }

      this.setupVideo(this.video);
      this.video.src = this.src;
      this.video.load();

      this.video.addEventListener("loadeddata", async () => {
        await this.extractFrames(this.video);
        this.ready = true;
        this.drawFrame(0);
        window.addEventListener("scroll", this.onScroll);
      });
    }
  }

  setupVideo(video) {
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    this.frames.length = 0;

    for (let i = 0; i < this.totalFrames; i++) {
      const t = (i * this.sampleEvery) / this.fps;

      await new Promise(resolve => {
        const onSeek = () => {
          videoElement.removeEventListener("seeked", onSeek);
          resolve();
        };
        videoElement.addEventListener("seeked", onSeek);
        videoElement.currentTime = t;
      });

      const bmp = await createImageBitmap(videoElement);
      this.frames.push(bmp);
    }
  }

  onScroll() {
    if (!this.ready) return;

    const scrollTop = window.scrollY;
    const sectionTop = this.section.offsetTop;
    const scrollLength = this.section.offsetHeight - window.innerHeight;

    const progress = Math.min(
      Math.max((scrollTop - sectionTop) / scrollLength, 0),
      1
    );

    let startFrame = 0;
    if (this.isIntro) {
      startFrame = Math.floor((this.autoplaySeconds * this.fps) / this.sampleEvery);
      startFrame = Math.min(Math.max(startFrame, 0), this.frames.length - 1);
    }

    const remainingFrames = (this.frames.length - 1) - startFrame;
    const index = startFrame + Math.floor(progress * remainingFrames);

    this.drawFrame(index);
  }

  drawFrame(index) {
    const frame = this.frames[index];
    if (!frame) return;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    this.ctx.drawImage(frame, 0, 0, window.innerWidth, window.innerHeight);
  }
}

// ==================== MOBILE VERSION (Optimized for speed) ====================
class MobileScrollVideo {
  constructor(section) {
    this.section = section;
    this.video = section.querySelector("video");
    this.canvas = section.querySelector("canvas");
    
    if (!this.video) {
      console.log("No video found");
      return;
    }
    
    // Hide canvas completely on mobile
    if (this.canvas) {
      this.canvas.style.display = "none";
    }
    
    // Get video source
    this.src = section.dataset.video;
    this.duration = Number(section.dataset.duration || 5);
    this.isIntro = Number(section.dataset.autoplay || 0) > 0;
    
    // Setup video for mobile
    this.setupMobileVideo();
    
    // Initialize
    this.init();
  }
  
  setupMobileVideo() {
    // Essential mobile settings
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.loop = !this.isIntro; // Loop only for non-intro sections
    
    // iOS specific attributes
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    
    // Make video visible and properly positioned
    this.video.style.display = "block";
    this.video.style.position = "absolute";
    this.video.style.top = "0";
    this.video.style.left = "0";
    this.video.style.width = "100%";
    this.video.style.height = "100%";
    this.video.style.objectFit = "cover";
    
    // Set video source
    if (this.src && !this.video.src) {
      this.video.src = this.src;
      this.video.load();
    }
  }
  
  init() {
    if (this.isIntro) {
      // Intro section: play once
      this.video.play().catch(e => console.log("Intro play failed:", e));
    } else {
      // Other sections: play/pause based on visibility
      this.setupIntersectionObserver();
    }
  }
  
  setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Video is visible - play it
          this.video.play().catch(e => console.log("Play failed:", e));
        } else {
          // Video is hidden - pause it
          this.video.pause();
        }
      });
    }, { threshold: 0.3 });
    
    observer.observe(this.video);
  }
}

// ==================== DEVICE DETECTION ====================
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ==================== SHARED ANIMATIONS (Work on both devices) ====================

// Initialize everything when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const mobile = isMobile();
  
  console.log("Device detected:", mobile ? "MOBILE" : "DESKTOP");
  
  // Add device class to body
  document.body.classList.add(mobile ? 'mobile-device' : 'desktop-device');
  
  // Initialize videos based on device
  document.querySelectorAll(".scroll-video").forEach(section => {
    if (mobile) {
      new MobileScrollVideo(section);
    } else {
      new DesktopScrollVideo(section);
    }
  });

  // ========== TEXT REVEAL ANIMATIONS (Same for all devices) ==========
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

  // ========== STAGGER ANIMATION FOR AMENITIES ==========
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

  // ========== SPLIT TEXT ANIMATION FOR INTRO ==========
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

  // ========== AOS INITIALIZATION ==========
  if (typeof AOS !== 'undefined') {
    AOS.init({ 
      duration: 1000, 
      once: false 
    });
  }

  // ========== 3D PARALLAX HERO (DESKTOP ONLY) ==========
  if (!mobile) {
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

  // ========== LOADER HANDLING ==========
  const loader = document.getElementById("site-loader");
  const curtain = document.getElementById("curtain");
  
  if (loader) {
    const MIN_TIME = mobile ? 1000 : 2000; // Shorter loader on mobile
    const start = Date.now();

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

// ========== VISIBILITY CHANGE HANDLER ==========
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    document.querySelectorAll("video").forEach(video => {
      if (!video.paused) video.pause();
    });
  }
});

// ========== MOBILE-SPECIFIC CSS ==========
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
  
  .text-panel {
    background: rgba(0, 0, 0, 0.6);
    padding: 20px;
    border-radius: 10px;
    backdrop-filter: blur(5px);
    margin: 0 20px;
    width: auto !important;
  }
  
  .section-title {
    font-size: 2rem !important;
  }
  
  .meta-bar {
    display: none !important;
  }
  
  .side-label {
    display: none !important;
  }
  
  .spotlight, .corner-light {
    display: none !important;
  }
}

/* Desktop canvas visible */
.desktop-device .scroll-video canvas {
  display: block;
}

.desktop-device .scroll-video video {
  display: none;
}
`;

// Add CSS to page
const styleElement = document.createElement('style');
styleElement.textContent = mobileCSS;
document.head.appendChild(styleElement);